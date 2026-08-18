// MCP client over stdio (JSON-RPC 2.0 with Content-Length framing)
// 用于把"MCP 连接器"类型的插件暴露的工具，接入 MultiChat 的 agent 工具循环。
const { spawn } = require('child_process');

class McpClient {
  constructor(command, args, cwd, env) {
    this.command = command;
    this.args = args || [];
    this.cwd = cwd;
    this.env = env || {};
    this.proc = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.started = false;
    this.ready = false;
    this.starting = null;
  }

  ensureStarted() {
    if (this.started) return this.starting;
    this.started = true;
    this.starting = (async () => {
      this.proc = spawn(this.command, this.args, {
        cwd: this.cwd || undefined,
        env: { ...process.env, ...this.env },
        windowsHide: true,
      });
      this.proc.stdout.on('data', (d) => this._onData(d));
      this.proc.stderr.on('data', (d) => {
        // 仅记录，避免污染 stdout 帧解析
        const s = d.toString();
        if (s.trim()) console.error('[mcp stderr]', s.trim().slice(0, 200));
      });
      this.proc.on('exit', (code) => {
        this.ready = false;
        this.proc = null;
        console.log('[mcp] server exited code', code);
      });
      // initialize
      await this._send({
        jsonrpc: '2.0', id: 0, method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'MultiChat', version: '1.0.0' },
        },
      });
      // 通知初始化完成（无需回复）
      this._send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      this.ready = true;
    })().catch((e) => {
      this.started = false;
      console.error('[mcp] start failed:', e.message);
      throw e;
    });
    return this.starting;
  }

  _send(msg) {
    return new Promise((resolve, reject) => {
      if (!this.proc) { reject(new Error('mcp server not started')); return; }
      const id = msg.id;
      if (id !== undefined && id !== null) this.pending.set(id, { resolve, reject });
      const data = JSON.stringify(msg);
      const frame = `Content-Length: ${Buffer.byteLength(data)}\r\n\r\n${data}`;
      try { this.proc.stdin.write(frame); } catch (e) { reject(e); return; }
      if (id === undefined || id === null) resolve();
    });
  }

  // 按字节偏移解析（Content-Length 是字节数，含中文多字节时需用 Buffer 而非字符串）
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const he = this.buffer.indexOf('\r\n\r\n');
      if (he < 0) break;
      const header = this.buffer.subarray(0, he).toString('ascii');
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) { this.buffer = this.buffer.subarray(he + 4); continue; }
      const len = parseInt(m[1], 10);
      const start = he + 4;
      if (this.buffer.length < start + len) break;
      const body = this.buffer.subarray(start, start + len).toString('utf8');
      this.buffer = this.buffer.subarray(start + len);
      let msg;
      try { msg = JSON.parse(body); } catch { continue; }
      if (msg.id !== undefined && msg.id !== null && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || 'mcp error'));
        else p.resolve(msg.result);
      }
    }
  }

  async listTools() {
    await this.ensureStarted();
    const r = await this._send({ jsonrpc: '2.0', id: this.nextId++, method: 'tools/list', params: {} });
    return (r && r.tools) || [];
  }

  async callTool(name, args) {
    await this.ensureStarted();
    const r = await this._send({ jsonrpc: '2.0', id: this.nextId++, method: 'tools/call', params: { name, arguments: args || {} } });
    return r;
  }
}

// 进程级缓存：同一启动配置只起一个 MCP server
const clientCache = new Map();
function getMcpClient(launch) {
  if (!launch || !launch.command) return null;
  const key = JSON.stringify(launch);
  if (!clientCache.has(key)) {
    clientCache.set(key, new McpClient(launch.command, launch.args, launch.cwd, launch.env));
  }
  return clientCache.get(key);
}

module.exports = { McpClient, getMcpClient };
