'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const tempData = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-extensions-'));
process.env.DATA_DIR = tempData;
process.env.MULTICHAT_PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const extensions = require('../extensions/manager');
const { McpStdioClient, McpHttpClient } = require('../mcp');
const { safeFetch } = require('../lib/ssrf.ts');

test.after(() => {
  fs.rmSync(tempData, { recursive: true, force: true });
});

test('parses standard SKILL.md frontmatter and instructions', () => {
  const parsed = extensions.parseSkillMarkdown('---\nname: sample\ndescription: A sample workflow\n---\n\nDo the useful thing.\n', 'SKILL.md');
  assert.equal(parsed.metadata.name, 'sample');
  assert.equal(parsed.metadata.description, 'A sample workflow');
  assert.equal(parsed.instructions, 'Do the useful thing.');
});

test('discovers repo marketplace plugins without flattening components', () => {
  const plugins = extensions.listPlugins();
  const writing = plugins.find(item => item.id === 'writing-toolkit');
  const developer = plugins.find(item => item.id === 'developer-toolkit');
  assert.ok(writing);
  assert.ok(developer);
  assert.equal(writing.components.skills, 3);
  assert.equal(developer.components.skills, 4);
  assert.match(writing.manifestPath, /\.codex-plugin[\\/]plugin\.json$/);
});

test('discovers plugin SKILL.md files as workflow skills', () => {
  const skills = extensions.listSkills();
  const weekly = skills.find(item => item.id === 'sk_weekly_report');
  assert.ok(weekly);
  assert.equal(weekly.type, 'workflow');
  assert.equal(weekly.source.kind, 'plugin');
  assert.match(weekly.instructions, /本周完成/);
});

test('accepts direct-map and wrapped plugin MCP configurations', () => {
  const server = { command: 'node', args: ['server.js'] };
  assert.deepEqual(extensions.mcpServerMap({ demo: server }), { demo: server });
  assert.deepEqual(extensions.mcpServerMap({ mcpServers: { demo: server } }), { demo: server });
  assert.deepEqual(extensions.mcpServerMap({ mcp_servers: { demo: server } }), { demo: server });
});

test('standard MCP stdio transport discovers and invokes live tools', async () => {
  const server = path.resolve(__dirname, '..', 'extensions', 'demo-mcp-server.js');
  const client = new McpStdioClient(process.execPath, [server], extensions.PROJECT_ROOT, {});
  try {
    const tools = await client.listTools();
    assert.deepEqual(tools.map(item => item.name), ['get_current_time', 'get_project_summary']);
    const result = await client.callTool('get_project_summary', {});
    assert.equal(result.isError, false);
    assert.equal(typeof result.structuredContent.node, 'string');
  } finally {
    client.close();
  }
});

test('safeFetch strips credentials on a cross-origin redirect', async () => {
  let received;
  const sink = http.createServer((req, res) => {
    received = req.headers;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  await new Promise(resolve => sink.listen(0, '127.0.0.1', resolve));
  const sinkPort = sink.address().port;
  const source = http.createServer((_req, res) => {
    res.writeHead(307, { Location: `http://127.0.0.1:${sinkPort}/target` });
    res.end();
  });
  await new Promise(resolve => source.listen(0, '127.0.0.1', resolve));
  const sourcePort = source.address().port;
  try {
    const response = await safeFetch(`http://127.0.0.1:${sourcePort}/redirect`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer must-not-leak',
        Cookie: 'session=must-not-leak',
        'X-Api-Key': 'must-not-leak',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }, true);
    assert.equal(response.status, 200);
    assert.equal(received.authorization, undefined);
    assert.equal(received.cookie, undefined);
    assert.equal(received['x-api-key'], undefined);
    assert.equal(received['content-type'], 'application/json');
  } finally {
    await Promise.all([
      new Promise(resolve => source.close(resolve)),
      new Promise(resolve => sink.close(resolve)),
    ]);
  }
});

test('HTTP MCP uses the negotiated protocol version after initialize', async () => {
  const versions = [];
  const client = new McpHttpClient('https://mcp.example.test', {}, async (_url, options) => {
    const message = JSON.parse(options.body);
    versions.push(options.headers['MCP-Protocol-Version']);
    if (message.method === 'initialize') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'stub', version: '1' } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const tools = await client.listTools();
  assert.deepEqual(tools, []);
  assert.deepEqual(versions, ['2025-06-18', '2024-11-05', '2024-11-05']);
});

test('HTTP MCP initialization respects a caller abort signal', async () => {
  const client = new McpHttpClient('https://mcp.example.test', {}, async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  }));
  const controller = new AbortController();
  const startedAt = Date.now();
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(client.listTools({ signal: controller.signal }), error => error.name === 'AbortError');
  assert.ok(Date.now() - startedAt < 1000);
});
