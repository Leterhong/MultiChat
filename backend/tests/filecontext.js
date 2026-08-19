'use strict';
// D1 端到端验证：普通模式 /v1/chat/completions 的文件上下文注入
// 复用 smoke.js 的设施（mock upstream 记录请求体 + DATA_DIR 隔离的 backend 子进程）。
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}
async function request(base, route, options = {}) {
  const response = await fetch(base + route, options);
  const text = await response.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { response, text, body };
}
async function waitForHealth(base, child) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('server exited before becoming healthy');
    try {
      const { response } = await request(base, '/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('server health timeout');
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-fc-'));
  const upstream = http.createServer((req, res) => {
    if (req.url !== '/v1/chat/completions') return res.writeHead(404).end();
    let input = '';
    req.on('data', chunk => { input += chunk; });
    req.on('end', () => {
      try { upstream.lastBody = JSON.parse(input); } catch {}
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'close' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`);
      res.end('data: [DONE]\n\n');
    });
  });

  let child;
  try {
    const upstreamPort = await listen(upstream);
    const portServer = http.createServer();
    const port = await listen(portServer);
    portServer.close();
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['--import', 'tsx', 'server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForHealth(base, child);

    const workspaces = await request(base, '/api/workspaces');
    const wsId = workspaces.body[0].id;
    const projects = await request(base, '/api/projects?workspaceId=' + encodeURIComponent(wsId));
    const prId = projects.body[0].id;
    const asset = await request(base, '/api/assets', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: prId, name: 'ctx.md', mimeType: 'text/markdown', content: 'D1-INJECT-MARKER-xyz' }),
    });
    assert.equal(asset.response.status, 201);
    const assetId = asset.body.id;

    const provider = await request(base, '/api/providers', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'FC', apiType: 'openai', baseUrl: `http://127.0.0.1:${upstreamPort}`, apiKey: 'test', models: ['echo'] }),
    });
    const pid = provider.body.id;
    const providerObj = { id: pid, name: 'FC', apiType: 'openai', baseUrl: `http://127.0.0.1:${upstreamPort}`, apiKey: 'test' };

    // 1) 带 projectId + assetIds → 应注入 system 且含资产内容
    upstream.lastBody = null;
    const r1 = await request(base, '/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: `${pid}:echo`, messages: [{ role: 'user', content: 'hi' }], stream: true, projectId: prId, assetIds: [assetId], _provider: providerObj }),
    });
    assert.equal(r1.response.status, 200, 'chat status 200');
    assert(upstream.lastBody, 'upstream received body');
    assert.equal(upstream.lastBody.messages[0].role, 'system', 'first message should be injected system');
    assert(upstream.lastBody.messages[0].content.includes('D1-INJECT-MARKER-xyz'), 'system should contain asset content');

    // 2) 不传 projectId → 不应注入 system（保持用户原始 messages）
    upstream.lastBody = null;
    await request(base, '/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: `${pid}:echo`, messages: [{ role: 'user', content: 'hi' }], stream: true, _provider: providerObj }),
    });
    assert.equal(upstream.lastBody.messages[0].role, 'user', 'without projectId no system injection');

    // 3) 传 projectId 但 assetIds 不含该文件 → 不应注入
    upstream.lastBody = null;
    await request(base, '/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: `${pid}:echo`, messages: [{ role: 'user', content: 'hi' }], stream: true, projectId: prId, assetIds: [], _provider: providerObj }),
    });
    assert.equal(upstream.lastBody.messages[0].role, 'user', 'empty assetIds => no system injection');

    console.log('D1 file-context injection test passed');
  } finally {
    if (child) child.kill();
    upstream.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exit(1); });
