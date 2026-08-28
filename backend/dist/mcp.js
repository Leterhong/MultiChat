'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// MCP client used by MultiChat's runtime and extension manager.
// STDIO follows the MCP transport contract: one JSON-RPC message per line.
// Streamable HTTP is supported for remote servers. Connections are cached by
// server configuration so tools/list and tools/call share one session.
const { spawn } = require('child_process');
const { redactSecrets } = require('./lib/redact');
const { readPackageVersion } = require('./lib/catalog');
const PROTOCOL_VERSION = '2025-06-18';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_STDOUT_BUFFER = 4 * 1024 * 1024;
const MAX_HTTP_BODY = 8 * 1024 * 1024;
function timeoutError(label) { return new Error(`${label} timed out`); }
function childEnvironment(extra) {
    // Arbitrary MCP packages do not inherit user profiles, credential helpers or
    // NODE_PATH. A server that truly needs a value must declare it explicitly in
    // its own MCP configuration.
    const keep = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP'];
    const base = {};
    for (const key of keep)
        if (process.env[key] !== undefined)
            base[key] = process.env[key];
    return { ...base, ...(extra || {}) };
}
async function readLimitedText(response, limit = MAX_HTTP_BODY) {
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > limit)
        throw new Error(`MCP HTTP response exceeds ${limit} bytes`);
    if (!response.body)
        return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let text = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > limit) {
            await reader.cancel();
            throw new Error(`MCP HTTP response exceeds ${limit} bytes`);
        }
        text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
}
class McpStdioClient {
    command;
    args;
    cwd;
    env;
    proc;
    buffer;
    nextId;
    pending;
    starting;
    ready;
    protocolVersion;
    serverInfo;
    instructions;
    constructor(command, args, cwd, env) {
        this.command = command;
        this.args = Array.isArray(args) ? args : [];
        this.cwd = cwd;
        this.env = env || {};
        this.proc = null;
        this.buffer = '';
        this.nextId = 1;
        this.pending = new Map();
        this.starting = null;
        this.ready = false;
        this.protocolVersion = PROTOCOL_VERSION;
        this.serverInfo = null;
        this.instructions = '';
    }
    async ensureStarted(options = {}) {
        if (this.ready && this.proc)
            return;
        if (this.starting)
            return this.starting;
        this.starting = this._start(options);
        try {
            await this.starting;
        }
        finally {
            this.starting = null;
        }
    }
    async _start(options = {}) {
        if (!this.command)
            throw new Error('MCP stdio command is required');
        this.proc = spawn(this.command, this.args, {
            cwd: this.cwd || undefined,
            env: childEnvironment(this.env),
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.proc.stdout.setEncoding('utf8');
        this.proc.stdout.on('data', (chunk) => this._onData(chunk));
        this.proc.stderr.setEncoding('utf8');
        this.proc.stderr.on('data', (chunk) => {
            const text = String(chunk).trim();
            if (text)
                console.error('[mcp stderr]', redactSecrets(text).slice(0, 500));
        });
        this.proc.on('error', (error) => this._disconnect(error));
        this.proc.on('exit', (code) => this._disconnect(new Error(`MCP server exited with code ${code}`)));
        try {
            const initialized = await this._request('initialize', {
                protocolVersion: PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'MultiChat', version: readPackageVersion() },
            }, options);
            this.protocolVersion = initialized?.protocolVersion || PROTOCOL_VERSION;
            this.serverInfo = initialized?.serverInfo || null;
            this.instructions = initialized?.instructions || '';
            this._notify('notifications/initialized', {});
            this.ready = true;
        }
        catch (error) {
            if (this.proc)
                this.proc.kill();
            this._disconnect(error);
            throw error;
        }
    }
    _disconnect(error) {
        this.ready = false;
        this.proc = null;
        this.buffer = '';
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            if (pending.signal && pending.onAbort)
                pending.signal.removeEventListener('abort', pending.onAbort);
            pending.reject(error);
        }
        this.pending.clear();
    }
    _write(message) {
        if (!this.proc?.stdin?.writable)
            throw new Error('MCP server is not running');
        this.proc.stdin.write(JSON.stringify(message) + '\n');
    }
    _notify(method, params) { this._write({ jsonrpc: '2.0', method, params }); }
    _request(method, params, options = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const signal = options.signal;
            const finish = (callback, value) => {
                const pending = this.pending.get(id);
                if (!pending)
                    return;
                this.pending.delete(id);
                clearTimeout(pending.timer);
                if (pending.signal && pending.onAbort)
                    pending.signal.removeEventListener('abort', pending.onAbort);
                callback(value);
            };
            const timer = setTimeout(() => {
                finish(reject, timeoutError(`MCP ${method}`));
            }, REQUEST_TIMEOUT_MS);
            const onAbort = () => {
                try {
                    this._notify('notifications/cancelled', { requestId: id, reason: 'cancelled by caller' });
                }
                catch { }
                const error = new Error('MCP request cancelled');
                error.name = 'AbortError';
                finish(reject, error);
            };
            this.pending.set(id, { resolve, reject, timer, signal, onAbort });
            if (signal) {
                if (signal.aborted) {
                    onAbort();
                    return;
                }
                signal.addEventListener('abort', onAbort, { once: true });
            }
            try {
                this._write({ jsonrpc: '2.0', id, method, params });
            }
            catch (error) {
                finish(reject, error);
            }
        });
    }
    _onData(chunk) {
        this.buffer += chunk;
        if (this.buffer.length > MAX_STDOUT_BUFFER) {
            const error = new Error('MCP stdout buffer limit exceeded');
            if (this.proc)
                this.proc.kill();
            this._disconnect(error);
            return;
        }
        while (true) {
            const newline = this.buffer.indexOf('\n');
            if (newline < 0)
                break;
            const line = this.buffer.slice(0, newline).trim();
            this.buffer = this.buffer.slice(newline + 1);
            if (!line)
                continue;
            let message;
            try {
                message = JSON.parse(line);
            }
            catch {
                console.error('[mcp] ignored non-JSON stdout line:', redactSecrets(line).slice(0, 200));
                continue;
            }
            if (message.id === undefined || message.id === null)
                continue;
            const pending = this.pending.get(message.id);
            if (!pending)
                continue;
            this.pending.delete(message.id);
            clearTimeout(pending.timer);
            if (pending.signal && pending.onAbort)
                pending.signal.removeEventListener('abort', pending.onAbort);
            if (message.error)
                pending.reject(new Error(message.error.message || 'MCP error'));
            else
                pending.resolve(message.result);
        }
    }
    async listTools(options = {}) {
        await this.ensureStarted(options);
        const tools = [];
        let cursor;
        do {
            const result = await this._request('tools/list', cursor ? { cursor } : {}, options);
            if (Array.isArray(result?.tools))
                tools.push(...result.tools);
            cursor = result?.nextCursor || null;
        } while (cursor);
        return tools;
    }
    async callTool(name, args, options = {}) {
        await this.ensureStarted(options);
        return this._request('tools/call', { name, arguments: args || {} }, options);
    }
    close() {
        if (this.proc)
            this.proc.kill();
        this._disconnect(new Error('MCP client closed'));
    }
}
class McpHttpClient {
    url;
    headers;
    fetchImpl;
    sessionId;
    nextId;
    ready;
    starting;
    protocolVersion;
    serverInfo;
    instructions;
    constructor(url, headers, fetchImpl) {
        this.url = url;
        this.headers = headers || {};
        this.fetchImpl = fetchImpl || fetch;
        this.sessionId = null;
        this.nextId = 1;
        this.ready = false;
        this.starting = null;
        this.protocolVersion = PROTOCOL_VERSION;
        this.serverInfo = null;
        this.instructions = '';
    }
    async ensureStarted(options = {}) {
        if (this.ready)
            return;
        if (this.starting)
            return this.starting;
        this.starting = (async () => {
            const initialized = await this._request('initialize', {
                protocolVersion: PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'MultiChat', version: readPackageVersion() },
            }, options);
            const negotiated = initialized?.protocolVersion;
            if (negotiated !== undefined && (typeof negotiated !== 'string' || !negotiated.trim())) {
                throw new Error('MCP server returned an invalid protocolVersion');
            }
            this.protocolVersion = negotiated || PROTOCOL_VERSION;
            this.serverInfo = initialized?.serverInfo || null;
            this.instructions = initialized?.instructions || '';
            await this._notify('notifications/initialized', {}, options);
            this.ready = true;
        })();
        try {
            await this.starting;
        }
        finally {
            this.starting = null;
        }
    }
    async _post(message, signal) {
        const headers = {
            ...this.headers,
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': this.protocolVersion,
        };
        if (this.sessionId)
            headers['MCP-Session-Id'] = this.sessionId;
        const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        const requestSignal = signal && AbortSignal.any ? AbortSignal.any([timeoutSignal, signal]) : (signal || timeoutSignal);
        const response = await this.fetchImpl(this.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(message),
            signal: requestSignal,
        });
        if (!response.ok)
            throw new Error(`MCP HTTP ${response.status}: ${(await readLimitedText(response, 64 * 1024)).slice(0, 300)}`);
        const sessionId = response.headers.get('mcp-session-id');
        if (sessionId)
            this.sessionId = sessionId;
        if (response.status === 202 || !response.body)
            return null;
        const text = await readLimitedText(response);
        if (!text.trim())
            return null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) {
            const messages = [];
            for (const block of text.split(/\r?\n\r?\n/)) {
                const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
                if (!data)
                    continue;
                try {
                    messages.push(JSON.parse(data));
                }
                catch { }
            }
            return messages.find(item => item.id === message.id) || messages.at(-1) || null;
        }
        return JSON.parse(text);
    }
    async _notify(method, params, options = {}) { await this._post({ jsonrpc: '2.0', method, params }, options.signal); }
    async _request(method, params, options = {}) {
        const id = this.nextId++;
        const message = await this._post({ jsonrpc: '2.0', id, method, params }, options.signal);
        if (!message)
            throw new Error(`MCP ${method} returned no response`);
        if (message.error)
            throw new Error(message.error.message || 'MCP error');
        return message.result;
    }
    async listTools(options = {}) {
        await this.ensureStarted(options);
        const tools = [];
        let cursor;
        do {
            const result = await this._request('tools/list', cursor ? { cursor } : {}, options);
            if (Array.isArray(result?.tools))
                tools.push(...result.tools);
            cursor = result?.nextCursor || null;
        } while (cursor);
        return tools;
    }
    async callTool(name, args, options = {}) {
        await this.ensureStarted(options);
        return this._request('tools/call', { name, arguments: args || {} }, options);
    }
    close() { this.ready = false; this.sessionId = null; }
}
const MCP_IDLE_TIMEOUT_MS = Math.max(30_000, Number(process.env.MCP_IDLE_TIMEOUT_MS || 5 * 60_000));
const clientCache = new Map();
function touchClient(key, cached) {
    clearTimeout(cached.timer);
    cached.timer = setTimeout(() => {
        const current = clientCache.get(key);
        if (current !== cached)
            return;
        current.client.close();
        clientCache.delete(key);
    }, MCP_IDLE_TIMEOUT_MS);
    cached.timer.unref?.();
}
function getMcpClient(config) {
    if (!config || (!config.command && !config.url))
        return null;
    const key = JSON.stringify({ ...config, fetchImpl: undefined });
    if (!clientCache.has(key)) {
        const client = config.url
            ? new McpHttpClient(config.url, config.headers, config.fetchImpl)
            : new McpStdioClient(config.command, config.args, config.cwd, config.env);
        const cached = { client, timer: setTimeout(() => { }, MCP_IDLE_TIMEOUT_MS) };
        clientCache.set(key, cached);
        touchClient(key, cached);
    }
    const cached = clientCache.get(key);
    touchClient(key, cached);
    return cached.client;
}
function closeMcpClient(config) {
    if (!config)
        return;
    const key = JSON.stringify({ ...config, fetchImpl: undefined });
    const cached = clientCache.get(key);
    if (cached) {
        clearTimeout(cached.timer);
        cached.client.close();
    }
    clientCache.delete(key);
}
function closeAllMcpClients() {
    for (const cached of clientCache.values()) {
        clearTimeout(cached.timer);
        cached.client.close();
    }
    clientCache.clear();
}
module.exports = {
    McpClient: McpStdioClient,
    McpStdioClient,
    McpHttpClient,
    getMcpClient,
    closeMcpClient,
    closeAllMcpClients,
    childEnvironment,
};
//# sourceMappingURL=mcp.js.map