const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createAdapter } = require('../adapters');

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
  const anthropic = createAdapter({ apiType: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'test' });
  assert(anthropic.getEndpoint().endsWith('/v1/messages'));
  const anthropicBody = anthropic.buildRequestBody('claude-test', [{ role: 'system', content: 'be useful' }, { role: 'user', content: 'hello' }], true, { max_tokens: 100, tools: [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: {} } } }], tool_choice: 'auto' });
  assert.equal(anthropicBody.system, 'be useful');
  assert.equal(anthropicBody.tools[0].name, 'lookup');

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-smoke-'));
  const upstream = http.createServer((req, res) => {
    if (req.url !== '/v1/chat/completions') return res.writeHead(404).end();
    let input = '';
    req.on('data', chunk => { input += chunk; });
    req.on('end', () => {
      try { upstream.lastBody = JSON.parse(input); } catch {}
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'close' });
      res.write(`data: ${JSON.stringify({ id: 'smoke', choices: [{ delta: { content: 'smoke-ok' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ id: 'smoke', choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } })}\n\n`);
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
    child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForHealth(base, child);

    const runtime = await request(base, '/api/runtime');
    assert.equal(runtime.response.status, 200);
    assert(runtime.body.capabilities.includes('run-history'));
    assert(runtime.body.counts.workspaces >= 1);
    const workspaces = await request(base, '/api/workspaces');
    assert.equal(workspaces.response.status, 200);
    const project = await request(base, '/api/projects?workspaceId=' + encodeURIComponent(workspaces.body[0].id));
    assert.equal(project.response.status, 200);
    assert(project.body.length >= 1);
    const localAsset = await request(base, '/api/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: project.body[0].id, name: 'context.md', mimeType: 'text/markdown', content: 'project-context-smoke' }) });
    assert.equal(localAsset.response.status, 201);
    const remoteAsset = await request(base, '/api/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: project.body[0].id, url: '/marketplace/skills.json', name: 'market-skills.json' }) });
    assert.equal(remoteAsset.response.status, 201);
    const blocked = await request(base, '/api/skills/sk_web_fetch/execute', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ policy: 'safe', params: { url: 'https://example.com' } }) });
    assert.equal(blocked.response.status, 403);
    const pluginCatalog = await request(base, '/api/plugins');
    assert(pluginCatalog.body.some(plugin => plugin.id === 'developer-toolkit'));

    const provider = await request(base, '/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke', apiType: 'openai', baseUrl: `http://127.0.0.1:${upstreamPort}`, apiKey: 'test', models: ['echo'] }),
    });
    assert.equal(provider.response.status, 200);
    const providerId = provider.body.id;

    const chat = await request(base, '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: `${providerId}:echo`, messages: [{ role: 'user', content: 'hello' }], stream: true }),
    });
    assert.equal(chat.response.status, 200);
    assert(chat.text.includes('smoke-ok'));

    const imported = await request(base, '/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: JSON.stringify({ skills: [{ id: 'smoke_skill', name: 'Smoke skill', type: 'prompt', config: { prompt: 'Be concise.' } }], agents: [{ id: 'smoke_agent', name: 'Smoke agent', systemPrompt: 'Answer with smoke-ok.', skillIds: ['smoke_skill'] }] }) }),
    });
    assert.equal(imported.response.status, 200);
    assert.equal(imported.body.skills, 1);
    assert.equal(imported.body.agents, 1);

    const urlImport = await request(base, '/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: '/marketplace/skills.json', source: 'smoke-marketplace' }),
    });
    assert.equal(urlImport.response.status, 200);
    assert(urlImport.body.skills >= 8);

    const installed = await request(base, '/api/plugins/demo-time-mcp/install', { method: 'POST' });
    assert.equal(installed.response.status, 200);
    const mcp = await request(base, '/api/skills/sk_mcp_time/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ params: {} }),
    });
    assert.equal(mcp.response.status, 200);
    assert.equal(mcp.body.ok, true);
    await request(base, '/api/plugins/demo-time-mcp/uninstall', { method: 'POST' });

    const agent = await request(base, '/api/agents/smoke_agent/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: `${providerId}:echo`, messages: [{ role: 'user', content: 'run' }], stream: true, projectId: project.body[0].id, assetIds: [localAsset.body.id], _provider: { id: providerId, apiType: 'openai', baseUrl: `http://127.0.0.1:${upstreamPort}`, apiKey: 'test' } }),
    });
    assert.equal(agent.response.status, 200);
    assert(agent.text.includes('"run"'));
    assert(agent.text.includes('smoke-ok'));
    assert(upstream.lastBody.messages.some(message => String(message.content || '').includes('project-context-smoke')));

    const runs = await request(base, '/api/runs');
    assert.equal(runs.response.status, 200);
    assert(runs.body.some(run => run.agentId === 'smoke_agent' && run.status === 'completed'));
    console.log('MultiChat smoke tests passed');
  } finally {
    if (child) child.kill();
    await new Promise(resolve => upstream.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
