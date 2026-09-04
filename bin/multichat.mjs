#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CLI_FILE = fileURLToPath(import.meta.url);
const PACKAGE_ROOT = path.resolve(path.dirname(CLI_FILE), '..');
const PACKAGE_JSON = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
const REPOSITORY_URL = 'https://github.com/Leterhong/MultiChat.git';
const COMMANDS = new Set(['web', 'doctor', 'init', 'pull', 'deploy', 'help']);
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const MINIMUM_NODE_VERSION = Object.freeze({ major: 22, minor: 13, patch: 0 });

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function optionValue(argv, index, option) {
  const current = argv[index];
  const equals = current.indexOf('=');
  if (equals >= 0) {
    const value = current.slice(equals + 1);
    if (!value) throw new CliError(`${option} 缺少参数值`);
    return { value, nextIndex: index + 1 };
  }
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new CliError(`${option} 缺少参数值`);
  return { value, nextIndex: index + 2 };
}

export function parseCliArgs(argv, cwd = process.cwd()) {
  const args = [...argv];
  let command = 'web';
  let commandExplicit = false;
  let index = 0;

  if (args[0] && !args[0].startsWith('-')) {
    if (!COMMANDS.has(args[0])) throw new CliError(`未知命令：${args[0]}`);
    command = args[0];
    commandExplicit = true;
    index = 1;
  }

  const options = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    open: true,
    workspace: path.resolve(cwd),
    dataDir: path.join(homedir(), '.multichat', 'data'),
    help: false,
    version: false,
  };
  const positionals = [];

  while (index < args.length) {
    const arg = args[index];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
      index += 1;
    } else if (arg === '-v' || arg === '--version') {
      options.version = true;
      index += 1;
    } else if (arg === '--no-open') {
      options.open = false;
      index += 1;
    } else if (arg === '--host' || arg.startsWith('--host=')) {
      const parsed = optionValue(args, index, '--host');
      options.host = parsed.value;
      index = parsed.nextIndex;
    } else if (arg === '--port' || arg.startsWith('--port=')) {
      const parsed = optionValue(args, index, '--port');
      options.port = Number(parsed.value);
      index = parsed.nextIndex;
    } else if (arg === '--workspace' || arg.startsWith('--workspace=')) {
      const parsed = optionValue(args, index, '--workspace');
      options.workspace = path.resolve(cwd, parsed.value);
      index = parsed.nextIndex;
    } else if (arg === '--data-dir' || arg.startsWith('--data-dir=')) {
      const parsed = optionValue(args, index, '--data-dir');
      options.dataDir = path.resolve(cwd, parsed.value);
      index = parsed.nextIndex;
    } else if (arg.startsWith('-')) {
      throw new CliError(`未知参数：${arg}`);
    } else {
      positionals.push(arg);
      index += 1;
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new CliError('--port 必须是 1 到 65535 之间的整数');
  }
  if (!options.host || !/^[a-zA-Z0-9.:[\]-]+$/.test(options.host)) {
    throw new CliError('--host 不是有效的主机名或 IP 地址');
  }
  if (positionals.length > 1 || (positionals.length && !['init', 'pull'].includes(command))) {
    throw new CliError(`${command} 命令不接受这些位置参数`);
  }

  return { command, commandExplicit, options, positionals };
}

function helpText(command) {
  if (command === 'init') {
    return `MultiChat init\n\n用法：\n  multichat init [目录]\n\n克隆源码仓库，安装根目录、后端和前端依赖，并生成完整生产构建。\n默认目录：./MultiChat`;
  }
  if (command === 'pull') {
    return `MultiChat pull\n\n用法：\n  multichat pull [目录]\n\n在现有 MultiChat 源码仓库中执行 git pull --ff-only，然后重新安装依赖并生成完整生产构建。\n默认目录：当前目录`;
  }
  if (command === 'web' || command === 'deploy') {
    return `MultiChat ${command}\n\n用法：\n  multichat ${command} [参数]\n\n参数：\n  --host <地址>       监听地址（默认 127.0.0.1）\n  --port <端口>       监听端口（默认 3000）\n  --no-open           启动后不自动打开浏览器\n  --workspace <目录>  Agent 工作区（默认当前目录）\n  --data-dir <目录>   运行数据目录（默认 ~/.multichat/data）\n  -h, --help          显示帮助\n\n${command === 'deploy' ? 'deploy 是本地部署入口，不会向远程服务器发布。' : '默认仅本机可访问；显式修改 --host 才会改变监听范围。'}`;
  }
  if (command === 'doctor') {
    return `MultiChat doctor\n\n用法：\n  multichat doctor [参数]\n\n在不启动网站的情况下检查 Node.js、TypeScript 运行时、前后端文件、工作区、数据目录和监听端口。\n\n参数：\n  --host <地址>       待检查的监听地址（默认 127.0.0.1）\n  --port <端口>       待检查的监听端口（默认 3000）\n  --workspace <目录>  待检查的 Agent 工作区\n  --data-dir <目录>   待检查的运行数据目录\n  -h, --help          显示帮助`;
  }
  return `MultiChat ${PACKAGE_JSON.version}\n\n本地优先的多模型 Agent 工作台。\n\n用法：\n  multichat [web] [参数]\n  multichat doctor [参数]\n  multichat init [目录]\n  multichat pull [目录]\n  multichat deploy [参数]\n\n命令：\n  web      启动本地网站（默认命令）\n  doctor   检查 Node、运行文件、目录和端口\n  init     克隆源码、安装依赖并构建\n  pull     快进更新现有源码、安装依赖并构建\n  deploy   web 的本地部署别名，不执行远程发布\n\n通用参数：\n  -h, --help       显示帮助\n  -v, --version    显示版本\n\n一条命令启动：\n  npx --yes github:Leterhong/MultiChat web\n\n查看子命令参数：\n  multichat web --help`;
}

function nodeVersionParts(version = process.versions.node) {
  const [major = 0, minor = 0, patch = 0] = String(version).split('.').map((value) => Number.parseInt(value, 10) || 0);
  return { major, minor, patch };
}

export function supportsRequiredNode(version = process.versions.node) {
  const current = nodeVersionParts(version);
  const required = MINIMUM_NODE_VERSION;
  return current.major > required.major
    || (current.major === required.major && current.minor > required.minor)
    || (current.major === required.major && current.minor === required.minor && current.patch >= required.patch);
}

function assertNodeVersion() {
  if (!supportsRequiredNode()) {
    throw new CliError(`MultiChat 需要 Node.js 22.13.0 或更高版本（SQLite 默认存储要求）；当前为 ${process.version}`);
  }
}

export function probeSqlite() {
  let database;
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
    if (typeof DatabaseSync !== 'function') throw new Error('DatabaseSync 不可用');
    database = new DatabaseSync(':memory:');
    database.exec('CREATE TABLE multichat_doctor (id INTEGER PRIMARY KEY) STRICT');
    return { ok: true, detail: 'node:sqlite / DatabaseSync 可用' };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    try { database?.close(); } catch {}
  }
}

function isDirectory(value) {
  try {
    return statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertDistinctDirectories(workspace, dataDir) {
  const left = comparablePath(workspace);
  const right = comparablePath(dataDir);
  if (left === right) throw new CliError('工作区与数据目录必须使用两个不同的目录');
}

function resolveRuntime() {
  const compiledEntry = path.join(PACKAGE_ROOT, 'backend', 'dist', 'server.js');
  const TypeScriptEntry = path.join(PACKAGE_ROOT, 'backend', 'server.ts');
  const legacyEntry = path.join(PACKAGE_ROOT, 'backend', 'server.js');
  const backendEntry = existsSync(compiledEntry) ? compiledEntry : (existsSync(TypeScriptEntry) ? TypeScriptEntry : legacyEntry);
  const frontendDist = path.join(PACKAGE_ROOT, 'frontend', 'dist');
  const frontendIndex = path.join(frontendDist, 'index.html');
  let tsxEntry = null;
  if (backendEntry === TypeScriptEntry) {
    const resolutionBases = [import.meta.url, pathToFileURL(path.join(PACKAGE_ROOT, 'backend', 'package.json')).href];
    for (const resolutionBase of resolutionBases) {
      try {
        tsxEntry = createRequire(resolutionBase).resolve('tsx');
        break;
      } catch {
        // Source-only development checkout: try the backend dependency tree.
      }
    }
  }
  return { backendEntry, compiledEntry, TypeScriptEntry, frontendDist, frontendIndex, tsxEntry };
}

function assertRuntime(runtime) {
  if (!existsSync(runtime.backendEntry)) {
    throw new CliError(`找不到服务入口：${runtime.backendEntry}`);
  }
  if (!existsSync(runtime.frontendIndex)) {
    throw new CliError('找不到 frontend/dist/index.html；源码运行请先执行 npm run build');
  }
  if (runtime.backendEntry === runtime.TypeScriptEntry && !runtime.tsxEntry) {
    throw new CliError('当前只有 TypeScript 源码；请先执行 npm run build');
  }
}

// 源码比构建产物新，说明上次改完没有重新构建——这正是“改了源码却不生效”的
// 常见根因。只告警不阻断：dist 仍是可用的上一版行为。
function newestSourceMtime(dir, skipNames, state = { mtime: 0 }) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return state; }
  for (const entry of entries) {
    if (skipNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) newestSourceMtime(full, skipNames, state);
    else if (/\.(?:ts|tsx|css)$/.test(entry.name)) {
      try { state.mtime = Math.max(state.mtime, statSync(full).mtimeMs); }
      catch { // 文件可能在扫描间隙被删除，忽略。
      }
    }
  }
  return state;
}

function warnIfStaleDist(runtime) {
  if (runtime.backendEntry !== runtime.compiledEntry) return;
  const backendRoot = path.join(PACKAGE_ROOT, 'backend');
  const newestSource = newestSourceMtime(backendRoot, new Set(['node_modules', 'dist', '.test-dist', 'data'])).mtime;
  let builtAt;
  try { builtAt = statSync(runtime.compiledEntry).mtimeMs; }
  catch { return; }
  if (newestSource > builtAt + 1500) {
    console.warn(`⚠  backend 源码比 backend/dist 新（上次构建后源码有改动）。当前运行的是旧构建；请执行 cd backend && npm run build 后重启。`);
    try {
      const newestFrontend = newestSourceMtime(path.join(PACKAGE_ROOT, 'frontend', 'src'), new Set()).mtime;
      const frontendIndex = statSync(runtime.frontendIndex).mtimeMs;
      if (newestFrontend > frontendIndex + 1500) {
        console.warn(`⚠  frontend 源码比 frontend/dist 新。请执行 cd frontend && npm run build 后刷新页面。`);
      }
    } catch { // frontend/src 不存在（发布包）时跳过。
    }
  }
}

function checkPort(host, port) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => resolvePort({ ok: false, error }));
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolvePort({ ok: true }));
    });
  });
}

function browserHost(host) {
  if (host === '0.0.0.0') return '127.0.0.1';
  if (host === '::' || host === '[::]') return '[::1]';
  if (host.includes(':') && !host.startsWith('[')) return `[${host}]`;
  return host;
}

function openBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'cmd.exe';
    args = ['/d', '/s', '/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }
  try {
    const opener = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    opener.once('error', () => {});
    opener.unref();
  } catch {
    // The URL is printed as a fallback, so missing desktop helpers are non-fatal.
  }
}

async function waitForHealth(url, child, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new CliError('服务在健康检查完成前退出');
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server may still be compiling or binding its socket.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new CliError('服务已启动，但 15 秒内未通过健康检查');
}

function waitForChild(child) {
  return new Promise((resolveChild, rejectChild) => {
    child.once('error', rejectChild);
    child.once('exit', (code, signal) => resolveChild({ code, signal }));
  });
}

async function runWeb(options, deployAlias = false) {
  assertNodeVersion();
  const runtime = resolveRuntime();
  assertRuntime(runtime);
  warnIfStaleDist(runtime);
  if (!isDirectory(options.workspace)) {
    throw new CliError(`工作区不存在或不是目录：${options.workspace}`);
  }
  assertDistinctDirectories(options.workspace, options.dataDir);
  await mkdir(options.dataDir, { recursive: true });
  try {
    probeDirectoryWrite(options.dataDir);
  } catch (error) {
    throw new CliError(`数据目录不可写：${options.dataDir}（${error.message}）`);
  }

  const port = await checkPort(options.host, options.port);
  if (!port.ok) {
    throw new CliError(`${options.host}:${options.port} 无法监听：${port.error?.message || '端口不可用'}`);
  }

  const url = `http://${browserHost(options.host)}:${options.port}`;
  console.log(deployAlias ? 'MultiChat 本地部署正在启动…' : 'MultiChat 正在启动…');
  console.log(`  网站：${url}`);
  console.log(`  工作区：${options.workspace}`);
  console.log(`  数据：${options.dataDir}`);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(options.host)) {
    console.warn(`  提醒：当前监听 ${options.host}，请自行确认网络访问边界。`);
  }

  const nodeArgs = runtime.backendEntry === runtime.TypeScriptEntry
    ? ['--import', pathToFileURL(runtime.tsxEntry).href, runtime.TypeScriptEntry]
    : [runtime.backendEntry];

  const child = spawn(process.execPath, nodeArgs, {
    cwd: options.workspace,
    env: {
      ...process.env,
      HOST: options.host,
      PORT: String(options.port),
      DATA_DIR: options.dataDir,
      FRONTEND_DIST: runtime.frontendDist,
      MULTICHAT_PROJECT_ROOT: options.workspace,
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
    stdio: 'inherit',
    windowsHide: false,
  });

  const forwardSignal = (signal) => {
    if (child.exitCode === null && !child.killed) child.kill(signal);
  };
  const onSigint = () => forwardSignal('SIGINT');
  const onSigterm = () => forwardSignal('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  void waitForHealth(url, child)
    .then(() => {
      console.log(`MultiChat 已就绪：${url}`);
      if (options.open && !process.env.CI) openBrowser(url);
    })
    .catch((error) => console.warn(`健康检查：${error.message}`));

  try {
    const result = await waitForChild(child);
    return result.code ?? (result.signal ? 1 : 0);
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  }
}

function nearestExistingDirectory(target) {
  let current = path.resolve(target);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return isDirectory(current) ? current : path.dirname(current);
}

function probeDirectoryWrite(directory) {
  const probe = path.join(directory, `.multichat-write-probe-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(probe, 'ok', { encoding: 'utf8', flag: 'wx' });
  } finally {
    try { unlinkSync(probe); } catch {}
  }
}

async function runDoctor(options) {
  const runtime = resolveRuntime();
  const results = [];
  const add = (status, label, detail) => results.push({ status, label, detail });

  add(supportsRequiredNode() ? 'PASS' : 'FAIL', 'Node.js', `${process.version}（需要 >=22.13.0）`);
  const sqlite = probeSqlite();
  add(sqlite.ok ? 'PASS' : 'FAIL', 'SQLite', sqlite.ok ? sqlite.detail : `${sqlite.detail}；可设置 MULTICHAT_STORE=json 临时降级`);
  add(existsSync(runtime.backendEntry) ? 'PASS' : 'FAIL', '后端构建', runtime.backendEntry);
  add(existsSync(runtime.frontendIndex) ? 'PASS' : 'FAIL', '前端构建', runtime.frontendIndex);
  if (runtime.backendEntry === runtime.TypeScriptEntry) add(runtime.tsxEntry ? 'PASS' : 'FAIL', '开发运行时', runtime.tsxEntry || '未安装 tsx');

  if (!isDirectory(options.workspace)) {
    add('FAIL', '工作区', `${options.workspace} 不存在或不是目录`);
  } else {
    try {
      accessSync(options.workspace, constants.R_OK | constants.W_OK);
      probeDirectoryWrite(options.workspace);
      add('PASS', '工作区', options.workspace);
    } catch (error) {
      add('FAIL', '工作区', `${options.workspace}：${error.message}`);
    }
  }

  if (comparablePath(options.workspace) === comparablePath(options.dataDir)) {
    add('FAIL', '数据目录', '不能与工作区相同');
  } else if (existsSync(options.dataDir) && !isDirectory(options.dataDir)) {
    add('FAIL', '数据目录', `${options.dataDir} 已存在，但不是目录`);
  } else {
    const writableRoot = nearestExistingDirectory(options.dataDir);
    try {
      if (!writableRoot) throw new Error('找不到可写父目录');
      accessSync(writableRoot, constants.W_OK);
      probeDirectoryWrite(writableRoot);
      add('PASS', '数据目录', existsSync(options.dataDir) ? options.dataDir : `${options.dataDir}（首次启动时创建）`);
    } catch (error) {
      add('FAIL', '数据目录', `${options.dataDir}：${error.message}`);
    }
  }

  const port = await checkPort(options.host, options.port);
  add(port.ok ? 'PASS' : 'FAIL', '监听端口', port.ok ? `${options.host}:${options.port} 可用` : `${options.host}:${options.port}：${port.error?.message}`);

  console.log(`MultiChat doctor ${PACKAGE_JSON.version}\n`);
  for (const result of results) {
    const marker = result.status === 'PASS' ? '✓' : '✗';
    console.log(`${marker} ${result.label.padEnd(14)} ${result.detail}`);
  }
  const failures = results.filter((item) => item.status === 'FAIL').length;
  console.log(failures ? `\n发现 ${failures} 个问题。` : '\n所有检查均已通过。');
  return failures ? 1 : 0;
}

function externalCommand(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function runExternal(command, args, cwd) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: false });
    child.once('error', rejectCommand);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveCommand();
      else rejectCommand(new CliError(`${command} ${args.join(' ')} 执行失败${signal ? `（${signal}）` : `（退出码 ${code}）`}`));
    });
  });
}

async function installAndBuild(sourceRoot) {
  const backendRoot = path.join(sourceRoot, 'backend');
  const frontendRoot = path.join(sourceRoot, 'frontend');
  if (!existsSync(path.join(sourceRoot, 'package.json')) || !existsSync(path.join(backendRoot, 'package.json')) || !existsSync(path.join(frontendRoot, 'package.json'))) {
    throw new CliError(`目录不是完整的 MultiChat 源码仓库：${sourceRoot}`);
  }
  const npm = externalCommand('npm');
  await runExternal(npm, ['install'], sourceRoot);
  await runExternal(npm, ['install'], backendRoot);
  await runExternal(npm, ['install'], frontendRoot);
  await runExternal(npm, ['run', 'build'], sourceRoot);
}

async function runInit(positionals) {
  assertNodeVersion();
  const target = path.resolve(positionals[0] || 'MultiChat');
  if (existsSync(target) && (!isDirectory(target) || readdirSync(target).length > 0)) {
    throw new CliError(`目标目录必须不存在或为空：${target}`);
  }
  console.log(`正在克隆 MultiChat 到 ${target}`);
  await runExternal('git', ['clone', '--depth', '1', REPOSITORY_URL, target], process.cwd());
  await installAndBuild(target);
  console.log(`\n初始化完成。\n  cd "${target}"\n  npm start`);
  return 0;
}

async function runPull(positionals) {
  assertNodeVersion();
  const target = path.resolve(positionals[0] || process.cwd());
  if (!existsSync(path.join(target, '.git'))) {
    throw new CliError(`目录不是 Git 源码仓库：${target}`);
  }
  console.log(`正在更新 ${target}`);
  await runExternal('git', ['pull', '--ff-only'], target);
  await installAndBuild(target);
  console.log('\n更新与构建完成。');
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseCliArgs(argv);
  if (parsed.options.version) {
    console.log(PACKAGE_JSON.version);
    return 0;
  }
  if (parsed.command === 'help' || parsed.options.help) {
    console.log(helpText(parsed.command === 'help' || !parsed.commandExplicit ? undefined : parsed.command));
    return 0;
  }
  if (parsed.command === 'doctor') return runDoctor(parsed.options);
  if (parsed.command === 'init') return runInit(parsed.positionals);
  if (parsed.command === 'pull') return runPull(parsed.positionals);
  return runWeb(parsed.options, parsed.command === 'deploy');
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === CLI_FILE;
if (invokedAsScript) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(`MultiChat：${error.message}`);
      process.exitCode = error.exitCode || 1;
    });
}
