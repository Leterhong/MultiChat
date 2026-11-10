'use strict';
// 默认自动令牌 + Host 白名单 + 跨站校验的集成测试。
// 真实启动编译后的 server，验证审计里那条 RCE 链的前置条件已被掐断。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

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

// undici fetch 会规范化 Host 头，这里用原生 http 精确构造伪造域名。
function rawRequest(base: string, requestPath: string, headers: Record<string, string>) {
  const url = new URL(base);
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request({
      host: url.hostname,
      port: Number(url.port),
      method: 'GET',
      path: requestPath,
      headers,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.once('error', reject);
    req.end();
  });
}

function cleanEnv(overrides: Record<string, string>) {
  return {
    ...process.env,
    MULTICHAT_API_TOKEN: '',
    MC_API_TOKEN: '',
    MULTICHAT_BASIC_AUTH: '',
    MULTICHAT_NO_AUTH: '',
    MULTICHAT_ALLOWED_HOSTS: '',
    MULTICHAT_STORE: 'json',
    ...overrides,
  };
}

async function startServer(overrides: Record<string, string> = {}) {
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const dataDir = mkdtempSync(path.join(tmpdir(), 'multichat-guard-'));
  const serverCwd = path.join(__dirname, '..', '..');
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: serverCwd,
    env: cleanEnv({ PORT: String(port), DATA_DIR: dataDir, ...overrides }),
    stdio: 'ignore',
  });
  for (let i = 0; i < 80; i += 1) {
    if (server.exitCode !== null) throw new Error(`server exited before startup (${server.exitCode})`);
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return { server, base, dataDir, stop: () => { server.kill(); rmSync(dataDir, { recursive: true, force: true }); } };
    } catch {}
    await delay(250);
  }
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
  throw new Error('server did not start');
}

test('默认自动令牌：未领取令牌的 API 返回 401，同源引导后可访问', async (t) => {
  const instance = await startServer();
  t.after(instance.stop);

  const denied = await fetch(`${instance.base}/api/tools`);
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('www-authenticate') || '', /Bearer/);

  const session = await fetch(`${instance.base}/api/session`);
  assert.equal(session.status, 200);
  const payload = await session.json() as { token?: string; mode?: string };
  assert.equal(payload.mode, 'auto');
  assert.ok((payload.token || '').length >= 32);

  const allowed = await fetch(`${instance.base}/api/tools`, {
    headers: { authorization: `Bearer ${payload.token}` },
  });
  assert.equal(allowed.status, 200);

  // 令牌不得通过跨站领取。
  const crossSite = await fetch(`${instance.base}/api/session`, {
    headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
  });
  assert.equal(crossSite.status, 403);
});

test('Host 白名单与跨站校验阻断伪造域名 / 跨站 API 请求', async (t) => {
  const instance = await startServer();
  t.after(instance.stop);

  const rebinding = await rawRequest(instance.base, '/api/conversations', { Host: 'attacker.example:3199' });
  assert.equal(rebinding.status, 403);
  assert.equal((JSON.parse(rebinding.body) as { code?: string }).code, 'HOST_NOT_ALLOWED');

  const crossOrigin = await rawRequest(instance.base, '/api/conversations', {
    Host: `127.0.0.1:${new URL(instance.base).port}`,
    Origin: 'https://evil.example',
  });
  assert.equal(crossOrigin.status, 403);

  const crossSite = await rawRequest(instance.base, '/api/conversations', {
    Host: `127.0.0.1:${new URL(instance.base).port}`,
    'Sec-Fetch-Site': 'cross-site',
  });
  assert.equal(crossSite.status, 403);

  // 本机另一个端口的同源站点（开发服务器）仍可访问 API。
  const localOrigin = await rawRequest(instance.base, '/api/health', {
    Host: `127.0.0.1:${new URL(instance.base).port}`,
    Origin: 'http://127.0.0.1:5173',
  });
  assert.equal(localOrigin.status, 200);
});

test('MULTICHAT_NO_AUTH=1 显式关闭鉴权，且不暴露自动令牌端点', async (t) => {
  const instance = await startServer({ MULTICHAT_NO_AUTH: '1' });
  t.after(instance.stop);

  assert.equal((await fetch(`${instance.base}/api/tools`)).status, 200);
  assert.equal((await fetch(`${instance.base}/api/session`)).status, 404);
});
