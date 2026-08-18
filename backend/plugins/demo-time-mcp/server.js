// 演示用 MCP 服务器（纯 Node，无任何外部依赖，离线可跑）
// 实现 JSON-RPC 2.0 over stdio（Content-Length 帧），与 backend/mcp.js 客户端兼容。
// 暴露两个工具：get_current_time、read_local_file
const fs = require('fs');

let buf = Buffer.alloc(0);

function send(obj) {
  const data = JSON.stringify(obj);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(data)}\r\n\r\n${data}`);
}

function parseFrames() {
  while (true) {
    const he = buf.indexOf('\r\n\r\n');
    if (he < 0) break;
    const header = buf.subarray(0, he).toString('ascii');
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) { buf = buf.subarray(he + 4); continue; }
    const len = parseInt(m[1], 10);
    const start = he + 4;
    if (buf.length < start + len) break;
    const body = buf.subarray(start, start + len).toString('utf8');
    buf = buf.subarray(start + len);
    let msg;
    try { msg = JSON.parse(body); } catch { continue; }
    handle(msg);
  }
}

const TOOLS = [
  {
    name: 'get_current_time',
    description: '返回当前时间（UTC ISO + 本地可读时间）',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_local_file',
    description: '读取本地文本文件内容（最多 4000 字符）',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: '文件绝对路径' } },
      required: ['path'],
    },
  },
];

async function handle(msg) {
  if (msg.id === undefined || msg.id === null) return; // 通知不回复
  try {
    if (msg.method === 'initialize') {
      send({
        jsonrpc: '2.0', id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'demo-time-mcp', version: '1.0.0' },
        },
      });
      return;
    }
    if (msg.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } });
      return;
    }
    if (msg.method === 'tools/call') {
      const name = msg.params && msg.params.name;
      const args = (msg.params && msg.params.arguments) || {};
      let text = '';
      if (name === 'get_current_time') {
        text = 'UTC: ' + new Date().toISOString() + '\n本地: ' + new Date().toString();
      } else if (name === 'read_local_file') {
        const p = String(args.path || '');
        if (!p) throw new Error('path is required');
        text = fs.readFileSync(p, 'utf8').substring(0, 4000);
      } else {
        throw new Error('unknown tool: ' + name);
      }
      send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text }] } });
      return;
    }
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'method not found' } });
  } catch (e) {
    send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'error: ' + e.message }], isError: true } });
  }
}

process.stdin.on('data', (d) => { buf = Buffer.concat([buf, d]); parseFrames(); });
process.stdin.on('end', () => process.exit(0));
