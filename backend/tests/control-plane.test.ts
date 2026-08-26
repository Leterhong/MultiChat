import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { createJsonStore } = require('../lib/store');
const { createProviderStore } = require('../lib/provider-store');
const { createWorkspaceStore } = require('../lib/workspace-store');
const { normalizeUsage, recordUsage, usageSummary } = require('../lib/usage');
const { calculateExpression } = require('../runtime/agent');
const { redactSecrets } = require('../lib/redact');
const { assertSafeUrl } = require('../lib/ssrf');
const { readResponseText } = require('../lib/util');

function temporaryStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-control-'));
  return { root, store: createJsonStore(root) };
}

test('provider credentials are encrypted at rest and masked over the public boundary', () => {
  const { root, store } = temporaryStore();
  try {
    const providers = createProviderStore(store);
    providers.save([{ id: 'demo', name: 'Demo', apiType: 'openai', baseUrl: 'https://example.com/v1', apiKey: 'sk-super-secret', models: ['demo-model'] }]);
    const disk = fs.readFileSync(path.join(root, 'providers.json'), 'utf8');
    assert.equal(disk.includes('sk-super-secret'), false);
    assert.match(disk, /enc:v1:/);
    assert.equal(providers.list()[0].apiKey, 'sk-super-secret');
    const publicRow = providers.publicList()[0];
    assert.equal(publicRow.apiKey, undefined);
    assert.equal(publicRow.apiKeyMasked, true);
    assert.equal(publicRow.apiKeyPreview, 'cret');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('legacy plaintext credentials are migrated without leaving a plaintext backup', () => {
  const { root, store } = temporaryStore();
  try {
    store.write('providers.json', [{ id: 'legacy', apiKey: 'legacy-secret' }]);
    const providers = createProviderStore(store);
    assert.equal(providers.list()[0].apiKey, 'legacy-secret');
    assert.equal(fs.readFileSync(path.join(root, 'providers.json'), 'utf8').includes('legacy-secret'), false);
    assert.equal(fs.readFileSync(path.join(root, 'providers.json.bak'), 'utf8').includes('legacy-secret'), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('usage ledger separates reported and estimated tokens and aggregates by day', async () => {
  const { root, store } = temporaryStore();
  try {
    await recordUsage(store, { providerId: 'p1', model: 'm1', interactionId: 'turn-1', timestamp: new Date().toISOString(), usage: normalizeUsage({ prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }) });
    await recordUsage(store, { providerId: 'p1', model: 'm1', interactionId: 'turn-2', timestamp: new Date().toISOString(), usage: normalizeUsage(null, [{ role: 'user', content: 'hello world' }], 'hello') });
    const summary = usageSummary(store, { range: '7', offsetMinutes: -480 });
    assert.equal(summary.totals.requests, 2);
    assert.equal(summary.totals.messages, 2);
    assert.equal(summary.totals.reportedTokens, 150);
    assert.ok(summary.totals.estimatedTokens > 0);
    assert.equal(summary.daily.length, 7);
    assert.equal(summary.models[0].name, 'm1');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('project usage filtering also applies to the activity heatmap', async () => {
  const { root, store } = temporaryStore();
  try {
    await recordUsage(store, { providerId: 'p1', projectId: 'project-a', model: 'm1', usage: { input: 10, output: 2, total: 12, source: 'reported' } });
    await recordUsage(store, { providerId: 'p1', projectId: 'project-b', model: 'm1', usage: { input: 20, output: 4, total: 24, source: 'reported' } });
    const summary = usageSummary(store, { range: '7', projectId: 'project-a' });
    assert.equal(summary.totals.totalTokens, 12);
    assert.equal(summary.heatmap.reduce((sum, day) => sum + day.totalTokens, 0), 12);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('project defaults persist through the workspace store allow-list', () => {
  const { root, store } = temporaryStore();
  try {
    const workspaces = createWorkspaceStore(store);
    workspaces.ensureSeed();
    const project = workspaces.projects()[0];
    const updated = workspaces.updateProject(project.id, { defaultAgentId: 'agent-one', defaultProviderId: 'provider-one', defaultModel: 'model:latest' });
    assert.equal(updated.defaultAgentId, 'agent-one');
    assert.equal(updated.defaultProviderId, 'provider-one');
    assert.equal(updated.defaultModel, 'model:latest');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('calculator uses a bounded parser instead of dynamic code execution', () => {
  assert.equal(calculateExpression('2 * (3 + 4) - 5 % 2'), 13);
  assert.equal(calculateExpression('-3.5 + 1.5'), -2);
  assert.throws(() => calculateExpression('process.exit()'), /disallowed/);
  assert.throws(() => calculateExpression('1 / 0'), /not finite/);
});

test('logs redact common API key, bearer and query-secret forms', () => {
  const value = redactSecrets('Bearer abcdefghijklmnop sk-abcdefghijk client_secret=very-secret&access_token=other-secret');
  assert.equal(value.includes('abcdefghijklmnop'), false);
  assert.equal(value.includes('sk-abcdefghijk'), false);
  assert.equal(value.includes('very-secret'), false);
  assert.equal(value.includes('other-secret'), false);
});

test('private-network opt-in still blocks link-local metadata addresses', async () => {
  await assert.rejects(assertSafeUrl('http://169.254.169.254/latest/meta-data', { allowPrivate: true }), /链路本地/);
  await assert.rejects(assertSafeUrl('http://100.100.100.200/latest/meta-data', { allowPrivate: true }), /元数据/);
  await assert.rejects(assertSafeUrl('http://[::ffff:a9fe:a9fe]/latest/meta-data', { allowPrivate: true }), /链路本地/);
  assert.equal((await assertSafeUrl('http://127.0.0.1:11434', { allowPrivate: true })).hostname, '127.0.0.1');
  assert.equal((await assertSafeUrl('http://[::1]:11434', { allowPrivate: true })).hostname, '[::1]');
});

test('bounded response reader stops oversized remote content', async () => {
  await assert.rejects(readResponseText(new Response('x'.repeat(128)), 64), /exceeds 64 bytes/);
  assert.equal(await readResponseText(new Response('safe'), 64), 'safe');
});
