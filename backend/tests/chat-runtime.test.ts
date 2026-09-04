'use strict';
// Chat 运行时端到端测试：真实启动 server，用内置 mock 提供方走完
// /v1/chat/completions 的非流式与流式（SSE）两条路径，并验证运行配置种子。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3560;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('server did not start');
}

test('mock provider completes non-stream and SSE chat, seeded agents exist', async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'multichat-chat-'));
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, MULTICHAT_STORE: 'json' },
    stdio: 'ignore',
  });
  t.after(() => { server.kill(); rmSync(dataDir, { recursive: true, force: true }); });
  await waitForServer();

  // 种子运行配置存在（UI 首启可见的三个默认配置）
  const agents = await fetch(`${BASE}/api/agents`).then(r => r.json()) as Array<{ id: string }>;
  assert.ok(agents.some(a => a.id === 'ag_researcher'), 'ag_researcher 应在种子数据中');

  const userNamedAgent = await fetch(`${BASE}/api/agents`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'client-chosen', name: 'ID 边界测试' }),
  });
  assert.equal(userNamedAgent.status, 200);
  assert.notEqual((await userNamedAgent.json() as { id: string }).id, 'client-chosen');

  // 无效请求稳定返回 400，且不能因 req.body/model 缺失把服务打崩。
  const invalid = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
  });
  assert.equal(invalid.status, 400);
  const invalidBody = await invalid.json() as { code: string };
  assert.equal(invalidBody.code, 'BAD_REQUEST');
  assert.equal((await fetch(`${BASE}/api/health`)).status, 200);

  // 注册 mock 提供方（baseUrl 命中本地 mock 特判，无需密钥或真实上游）
  const created = await fetch(`${BASE}/api/providers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'mock', apiType: 'openai', baseUrl: 'http://127.0.0.1:3099', models: ['echo'], allowPrivate: true }),
  });
  assert.equal(created.status, 200);

  const probe = await fetch(`${BASE}/api/providers/mock/probe`, { method: 'POST' });
  assert.equal(probe.status, 200);
  const probeData = await probe.json() as { ok: boolean; models: string[] };
  assert.equal(probeData.ok, true);
  assert.deepEqual(probeData.models, ['echo']);

  const payload = {
    providerId: 'mock',
    model: 'echo',
    messages: [{ role: 'user', content: '你好' }],
  };

  // 1) 非流式：回声内容 + usage
  const plain = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, stream: false }),
  });
  assert.equal(plain.status, 200);
  const data = await plain.json() as { choices: Array<{ message: { content: string } }>; usage: { total_tokens: number } };
  assert.match(data.choices[0].message.content, /本地回声：你好/);
  assert.ok(data.usage.total_tokens > 0);

  // 2) 流式：SSE 分片 + [DONE] 结尾
  const streamed = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, stream: true }),
  });
  assert.equal(streamed.status, 200);
  const text = await streamed.text();
  assert.ok(text.includes('"delta"'), '应有 delta 分片');
  assert.ok(text.includes('[DONE]'), '应以 [DONE] 结尾');
  assert.ok(text.includes('本地回声'), '分片应拼出回声内容');
});
