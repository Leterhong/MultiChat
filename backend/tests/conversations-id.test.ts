'use strict';
// 回归测试：conversations 路由的 :id 必须过白名单。带路径分隔符/遍历片段的
// id 曾会穿透到 store 文件名拼接上，触发 500 并泄漏内部错误信息。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3558;
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

test('conversation ids with traversal or separators return 400, never 500', async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'multichat-convid-'));
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, MULTICHAT_STORE: 'json' },
    stdio: 'ignore',
  });
  t.after(() => { server.kill(); rmSync(dataDir, { recursive: true, force: true }); });
  await waitForServer();

  // 1) 遍历 id：到达处理器的返回 400；含 %2F 的在路由层被拒（404）。
  //    两种层级都安全 —— 关键断言是绝不出现 500（旧实现会 500 并泄漏内部错误）。
  for (const bad of ['..%2F..%2Fagents', '%2e%2e', 'x%2Fy']) {
    const get = await fetch(`${BASE}/api/conversations/${bad}`);
    assert.ok([400, 404].includes(get.status), `GET ${bad} → ${get.status}（不得 500）`);
    const del = await fetch(`${BASE}/api/conversations/${bad}`, { method: 'DELETE' });
    assert.ok([400, 404].includes(del.status), `DELETE ${bad} → ${del.status}（不得 500）`);
    const post = await fetch(`${BASE}/api/conversations/${bad}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]',
    });
    assert.ok([400, 404].includes(post.status), `POST messages ${bad} → ${post.status}（不得 500）`);
  }

  // 2) 正常但不存在 id → 404（业务语义正确）
  const missing = await fetch(`${BASE}/api/conversations/conv_does_not_exist`);
  assert.equal(missing.status, 404);

  // 3) 超长 id → 400
  const long = await fetch(`${BASE}/api/conversations/${'a'.repeat(200)}`);
  assert.equal(long.status, 400);

  // 4) 正常流程不受影响：创建 → 取回 → 删除
  const created = await fetch(`${BASE}/api/conversations`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'client-chosen', createdAt: '2000-01-01', title: '回归测试' }),
  });
  assert.equal(created.status, 200);
  const conv = await created.json() as { id: string; createdAt: string };
  assert.notEqual(conv.id, 'client-chosen');
  assert.notEqual(conv.createdAt, '2000-01-01');

  // 消息存储拒绝会让前端状态损坏的非数组/非法结构。
  const invalidMessages = await fetch(`${BASE}/api/conversations/${conv.id}/messages`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'user', content: 'not-an-array' }),
  });
  assert.equal(invalidMessages.status, 400);
  const validMessages = await fetch(`${BASE}/api/conversations/${conv.id}/messages`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ role: 'user', content: 'hello' }]),
  });
  assert.equal(validMessages.status, 200);

  const got = await fetch(`${BASE}/api/conversations/${conv.id}`);
  assert.equal(got.status, 200);
  const removed = await fetch(`${BASE}/api/conversations/${conv.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
});
