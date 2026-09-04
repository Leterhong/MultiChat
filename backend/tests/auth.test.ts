'use strict';
// 鉴权中间件集成测试：真实启动编译后的 server（而非 import），验证
// MULTICHAT_API_TOKEN 对 /api/* 与 /v1/* 的保护范围与放行路径。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const TOKEN = 'test-token-abc123';

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(base: string, server: ReturnType<typeof spawn>) {
  for (let i = 0; i < 80; i += 1) {
    if (server.exitCode !== null) throw new Error(`server exited before startup (code ${server.exitCode})`);
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('server did not start');
}

test('MULTICHAT_API_TOKEN protects /api/* and /v1/*, health stays open', async (t) => {
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const dataDir = mkdtempSync(path.join(tmpdir(), 'multichat-auth-'));
  // 编译后本文件位于 .test-dist/tests/，server.js 在 ../../dist（即 backend/dist）。
  const serverCwd = path.join(__dirname, '..', '..');
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: serverCwd,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, MULTICHAT_API_TOKEN: TOKEN, MULTICHAT_STORE: 'json' },
    stdio: 'ignore',
  });
  t.after(() => { server.kill(); rmSync(dataDir, { recursive: true, force: true }); });
  await waitForServer(base, server);

  // 1) 健康检查始终免鉴权
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);

  // 2) 无 token 访问 API → 401 + WWW-Authenticate
  const denied = await fetch(`${base}/api/tools`);
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('www-authenticate') || '', /Bearer/);

  // 3) 无 token 访问 /v1 → 401（OpenAI 兼容端点同样受保护）
  const v1Denied = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'x', messages: [] }),
  });
  assert.equal(v1Denied.status, 401);

  // 4) 带 Bearer token → 通过鉴权（进入业务层，不再返回 401）
  const apiOk = await fetch(`${base}/api/tools`, { headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(apiOk.status, 200);
  const v1Ok = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ model: 'nonexistent-model', messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.notEqual(v1Ok.status, 401);

  // 5) 错误 token → 仍是 401
  const wrong = await fetch(`${base}/api/tools`, { headers: { authorization: 'Bearer wrong-token' } });
  assert.equal(wrong.status, 401);
});
