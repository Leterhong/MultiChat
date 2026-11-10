'use strict';
// STDIO MCP 启动策略：MCP 配置可通过 HTTP API 创建，等价于「让本地服务执行
// 一条命令」。因此这里把可执行程序、内联代码参数、危险环境变量三类入口
// 全部收紧，避免未鉴权/被诱导的请求把 API 变成任意命令执行通道。
//
// 注意：仅校验可执行名是不够的 —— `node -e "<code>"` 同样能执行任意代码；
// `NODE_OPTIONS=--import=data:text/javascript,...` 也能绕过参数检查。
const path = require('path');
const { AppError } = require('./errors');

// 常见 MCP 启动器。需要更多程序时由部署者显式通过环境变量扩展。
const DEFAULT_COMMANDS = new Set([
  'node', 'node.exe', 'nodejs',
  'python', 'python.exe', 'python3', 'python3.exe',
  'npx', 'npx.cmd', 'uvx', 'uvx.exe', 'uv', 'uv.exe',
  'bun', 'bun.exe', 'deno', 'deno.exe',
]);

// 这些环境变量能改变解释器行为或劫持可执行文件查找路径。
const FORBIDDEN_ENV_KEYS = new Set([
  'NODE_OPTIONS', 'NODE_PATH', 'NODE_REPL_HISTORY',
  'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH',
  'PYTHONPATH', 'PYTHONSTARTUP', 'PYTHONINSPECT',
  'PATH', 'BASH_ENV', 'ENV', 'CDPATH', 'IFS',
]);

// 允许执行内联代码 / 加载任意模块的参数（含短参数与 = 形式）。
const INLINE_EXEC_FLAGS = new Set([
  '-e', '--eval', '-p', '--print', '-c', '--command', '--exec',
  '-r', '--require', '--import', '--loader', '--experimental-loader',
  '/c', '-command', '-encodedcommand', '-enc',
]);
const INLINE_EXEC_PREFIX = /^(?:-e|-p|-c|--eval|--print|--exec|--command|--require|--import|--loader|--experimental-loader)[=:]/i;
const UNSAFE_SCHEME = /^(?:data|javascript|vbscript|file):/i;
const SHELL_METACHAR = /[;&|`]|\$\(|\$\{/;

function allowedCommands() {
  const commands = new Set(DEFAULT_COMMANDS);
  for (const entry of String(process.env.MULTICHAT_MCP_ALLOWED_COMMANDS || '').split(',')) {
    const value = entry.trim().toLowerCase();
    if (value) commands.add(path.basename(value));
  }
  return commands;
}

function reject(message: string) {
  throw new AppError('PERMISSION_DENIED', `MCP 启动配置被拒绝：${message}`);
}

/**
 * 校验一次 STDIO MCP 启动配置。HTTP transport 由 lib/ssrf.ts 另行约束。
 * 传进来的应是 mcpLaunch() 的结果（command / args / env）。
 */
function assertSafeMcpLaunch(launch: unknown) {
  if (!launch || typeof launch !== 'object') return;
  const record = launch as { url?: string; command?: string; args?: unknown; env?: unknown };
  // HTTP MCP 不走 spawn，由 safeFetch 的逐跳 SSRF 校验负责。
  if (record.url) {
    if (record.command) reject('HTTP 与 STDIO 配置不能混合');
    return;
  }

  const command = String(record.command || '').trim();
  const base = path.basename(command).toLowerCase();
  if (!allowedCommands().has(base)) {
    reject(`可执行文件 "${base}" 不在允许列表（可用 MULTICHAT_MCP_ALLOWED_COMMANDS 扩展）`);
  }

  const args: string[] = Array.isArray(record.args) ? (record.args as unknown[]).map(String) : [];
  if (!args.length) reject('STDIO MCP 必须提供一个入口脚本或模块参数');
  for (const arg of args) {
    const normalized = arg.trim().toLowerCase();
    if (INLINE_EXEC_FLAGS.has(normalized) || INLINE_EXEC_PREFIX.test(arg)) {
      reject(`参数 "${arg}" 属于内联代码 / 任意模块加载，不允许`);
    }
    if (UNSAFE_SCHEME.test(arg.replace(/[\s\u0000-\u001f]/g, ''))) {
      reject(`参数包含不受支持的 URL scheme`);
    }
    if (SHELL_METACHAR.test(arg)) reject('参数包含 shell 元字符');
  }

  const env = record.env && typeof record.env === 'object' && !Array.isArray(record.env)
    ? (record.env as Record<string, unknown>)
    : {};
  for (const key of Object.keys(env)) {
    if (FORBIDDEN_ENV_KEYS.has(key.toUpperCase())) reject(`环境变量 "${key}" 可改变解释器行为，不允许`);
  }
}

module.exports = { assertSafeMcpLaunch, DEFAULT_COMMANDS, FORBIDDEN_ENV_KEYS };
