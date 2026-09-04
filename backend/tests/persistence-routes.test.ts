'use strict';
// Persistence-sensitive endpoints must acknowledge only after durable mutation,
// and concurrent approval decisions must have exactly one winner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3562;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('server did not start');
}

test('templates persist before acknowledgement and approvals are atomic', async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'multichat-persistence-'));
  const run = {
    id: 'run_atomic',
    status: 'paused',
    approvals: [{ id: 'approval_once', status: 'pending' }],
    checkpoint: {},
  };
  writeFileSync(path.join(dataDir, 'runs.json'), JSON.stringify([run]), 'utf8');
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, MULTICHAT_STORE: 'json' },
    stdio: 'ignore',
  });
  t.after(() => { server.kill(); rmSync(dataDir, { recursive: true, force: true }); });
  await waitForServer();

  const created = await fetch(`${BASE}/api/prompt-templates`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'pt_test', name: '测试模板', content: '请先检查再执行' }),
  });
  assert.equal(created.status, 201);
  const templates = await fetch(`${BASE}/api/prompt-templates`).then(response => response.json()) as Array<{ id: string }>;
  assert.ok(templates.some(item => item.id === 'pt_test'));

  const missingDelete = await fetch(`${BASE}/api/prompt-templates/not-found`, { method: 'DELETE' });
  assert.equal(missingDelete.status, 404);

  const decide = (action: string) => fetch(`${BASE}/api/runs/run_atomic/approval/approval_once`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const decisions = await Promise.all([decide('approve'), decide('reject')]);
  assert.deepEqual(decisions.map(response => response.status).sort(), [200, 409]);

  const stored = JSON.parse(readFileSync(path.join(dataDir, 'runs.json'), 'utf8')) as Array<any>;
  const approval = stored[0].approvals[0];
  assert.ok(['approved', 'rejected'].includes(approval.status));
  assert.ok(approval.resolvedAt);
});
