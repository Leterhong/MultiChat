'use strict';

// Dependency-free MCP STDIO fixture used by the default project setup and
// interoperability tests. Each JSON-RPC message occupies exactly one line.
const readline = require('readline');

const tools = [
  {
    name: 'get_current_time',
    description: '返回 UTC 时间、本地时间和当前时区。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_project_summary',
    description: '返回当前 MultiChat 项目的运行目录与 Node.js 版本。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
];

function send(message) { process.stdout.write(JSON.stringify(message) + '\n'); }

async function handle(message) {
  if (!message || message.jsonrpc !== '2.0') return;
  if (message.id === undefined || message.id === null) return;
  if (message.method === 'initialize') {
    return send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'multichat-demo', version: '1.0.0' },
        instructions: 'These tools are read-only and intended for local interoperability checks.',
      },
    });
  }
  if (message.method === 'tools/list') {
    return send({ jsonrpc: '2.0', id: message.id, result: { tools } });
  }
  if (message.method === 'tools/call') {
    const name = message.params?.name;
    let data;
    if (name === 'get_current_time') {
      data = { utc: new Date().toISOString(), local: new Date().toString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    } else if (name === 'get_project_summary') {
      data = { cwd: process.cwd(), node: process.version, platform: process.platform };
    } else {
      return send({ jsonrpc: '2.0', id: message.id, error: { code: -32602, message: `Unknown tool: ${name}` } });
    }
    return send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
        isError: false,
      },
    });
  }
  send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } });
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', line => {
  if (!line.trim()) return;
  try { void handle(JSON.parse(line)); }
  catch (error) { console.error(error.message); }
});
