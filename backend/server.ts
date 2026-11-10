'use strict';
// ── MultiChat Agent Workspace · 应用装配入口 ───────────────────────────
// 本文件只负责：加载共享上下文、注册中间件、挂载各路由模块、托管前端静态资源、
// 注册全局错误处理、执行数据种子、监听端口。具体业务逻辑已拆分到：
//   routes/    —— 各 REST 端点（providers / conversations / workspaces /
//                assistants / runs / skills / agents / plugins / import / chat / meta）
//   runtime/   —— Agent 运行时核心（技能 / 智能体 / 运行）
//   extensions/—— 标准 Skills、MCP servers 与插件来源注册表
//   lib/       —— 存储、SSRF、catalog、workspace-store、统一错误码、共享上下文
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const ctx = require('./lib/context');
const { requestIdMiddleware, errorHandler } = require('./lib/errors');
const runtime = require('./runtime/agent');

const app = express();
const PORT = ctx.PORT;
const HOST = process.env.HOST || '127.0.0.1';

// ── 访问边界：Host 白名单 + 跨站请求拦截（防 DNS rebinding / 跨站 CSRF）──
// 回环监听时严格校验 Host：恶意页面即便把域名重绑定到 127.0.0.1，
// 浏览器携带的 Host 仍是攻击者域名，会被这里直接拒绝。
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '0.0.0.0', '::']);
const allowedHosts = new Set(LOOPBACK_HOSTS);
allowedHosts.add(String(HOST).toLowerCase());
for (const entry of String(process.env.MULTICHAT_ALLOWED_HOSTS || '').split(',')) {
  const value = entry.trim().toLowerCase();
  if (value) allowedHosts.add(value);
}
const strictHostCheck = LOOPBACK_HOSTS.has(String(HOST).toLowerCase());

function hostnameOf(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('[')) {
    const close = raw.indexOf(']');
    return close >= 0 ? raw.slice(0, close + 1) : raw;
  }
  return raw.split(':')[0];
}

function isAllowedHostname(host) {
  return allowedHosts.has(host) || allowedHosts.has(String(host).replace(/^\[|\]$/g, ''));
}

app.use((req, res, next) => {
  if (strictHostCheck && !isAllowedHostname(hostnameOf(req.headers.host))) {
    return res.status(403).json({ error: { message: 'Host not allowed' }, code: 'HOST_NOT_ALLOWED' });
  }
  return next();
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/v1/')) return next();
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    return res.status(403).json({ error: { message: 'Cross-site request rejected' }, code: 'CROSS_SITE_REJECTED' });
  }
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return next();
  let parsed;
  try { parsed = new URL(origin); } catch { parsed = null; }
  if (!parsed || !/^https?:$/.test(parsed.protocol) || !isAllowedHostname(hostnameOf(parsed.host))) {
    return res.status(403).json({ error: { message: 'Cross-origin request rejected' }, code: 'CROSS_SITE_REJECTED' });
  }
  return next();
});

// ── 自动访问令牌 ──
// 未显式提供令牌、也未显式关闭鉴权时，服务自动生成随机令牌并持久化到数据目录
// （权限 0600）。同源页面通过下面的 /api/session 领取，避免手工配置令牌。
// 需要完全开放的旧部署可用 MULTICHAT_NO_AUTH=1 显式关闭。
function resolveAccess() {
  const explicit = String(process.env.MULTICHAT_API_TOKEN || process.env.MC_API_TOKEN || '').trim();
  const basic = String(process.env.MULTICHAT_BASIC_AUTH || '').trim();
  const disabled = /^(1|true|yes|on)$/i.test(String(process.env.MULTICHAT_NO_AUTH || '').trim());
  if (explicit || basic || disabled) return { token: explicit, basicAuth: basic, auto: false };

  const tokenFile = path.join(ctx.DATA_DIR, '.runtime-token');
  try {
    const saved = fs.readFileSync(tokenFile, 'utf8').trim();
    if (saved.length >= 32) return { token: saved, basicAuth: '', auto: true };
  } catch { /* 首次启动或文件不可用，继续生成 */ }
  const generated = crypto.randomBytes(32).toString('base64url');
  try {
    fs.mkdirSync(ctx.DATA_DIR, { recursive: true });
    fs.writeFileSync(tokenFile, generated, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  } catch { /* 数据目录只读时退化为内存令牌，重启后由前端重新引导 */ }
  return { token: generated, basicAuth: '', auto: true };
}
const access = resolveAccess();
const apiToken = access.token;
const basicAuth = access.basicAuth;

// 同源引导端点：只发给「与被访问 Host 完全同源、且非跨站」的页面。
// DNS rebinding 页面会先被 Host 白名单或 Origin/Sec-Fetch-Site 校验拒绝。
app.get('/api/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!access.auto) return res.status(404).json({ error: { message: 'Not found' }, code: 'NOT_FOUND' });
  // 允许本机另一个端口的开发页面领取（?api= 只放行回环地址），
  // 但任何非本机 Origin 都拿不到令牌；Host 白名单另行挡住伪造域名。
  const origin = String(req.headers.origin || '').trim();
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); } catch { parsed = null; }
    if (!parsed || !/^https?:$/.test(parsed.protocol) || !isAllowedHostname(hostnameOf(parsed.host))) {
      return res.status(403).json({ error: { message: 'Same-origin required' }, code: 'SAME_ORIGIN_REQUIRED' });
    }
  }
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    return res.status(403).json({ error: { message: 'Same-site required' }, code: 'SAME_ORIGIN_REQUIRED' });
  }
  return res.json({ token: apiToken, mode: 'auto' });
});

// ── 基础中间件 ──
const corsOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
if (corsOrigins.length) app.use(cors({ origin: corsOrigins, credentials: false }));
// Extension packages are transported as Base64 JSON so the API stays usable
// behind the same reverse proxies as the rest of MultiChat.  The importer
// applies a stricter 20 MB compressed / 80 MB unpacked limit of its own.
app.use(express.json({ limit: '32mb' }));
function equalSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
app.use((req, res, next) => {
  if ((!apiToken && !basicAuth) || (!req.path.startsWith('/api/') && !req.path.startsWith('/v1/')) || req.path === '/api/health' || req.path === '/api/session') return next();
  const authorization = String(req.headers.authorization || '');
  const bearerOk = apiToken && authorization.startsWith('Bearer ') && equalSecret(authorization.slice(7), apiToken);
  const basicOk = basicAuth && authorization.startsWith('Basic ') && equalSecret(Buffer.from(authorization.slice(6), 'base64').toString('utf8'), basicAuth);
  if (bearerOk || basicOk) return next();
  res.setHeader('WWW-Authenticate', 'Bearer realm="MultiChat"');
  return res.status(401).json({ error: { message: 'MultiChat access token required' }, code: 'AUTH_REQUIRED' });
});
// 与 frontend/vite.config.ts 注入到 dist/index.html 的 CSP meta 保持一致：
// 静态部署没有 Express 响应头时，meta 提供等价兜底。
const CSP_POLICY = "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*; form-action 'self'";
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', `frame-ancestors 'none'; ${CSP_POLICY}`);
  if (req.path.startsWith('/api/') || req.path.startsWith('/v1/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
// 统一请求ID：每个请求分配 id 并写入响应头 X-Request-Id（A3）
app.use(requestIdMiddleware);

// ── 路由注册 ──
require('./routes/providers')(app);
require('./routes/conversations')(app);
require('./routes/workspaces')(app);
require('./routes/assistants')(app);
require('./routes/runs')(app);
require('./routes/prompt-templates')(app);
require('./routes/usage')(app);
require('./routes/control-plane')(app);
require('./routes/skills')(app);
require('./routes/tools')(app);
require('./routes/mcp-servers')(app);
require('./routes/agents')(app);
require('./routes/plugins')(app);
require('./routes/extensions-import')(app);
require('./routes/import')(app);
require('./routes/mock')(app);
require('./routes/chat')(app);
require('./routes/meta')(app);

// ── 前端静态资源（生产构建件） ──
// 默认按源码布局取 ../frontend/dist；CLI 或打包运行时可通过 FRONTEND_DIST 覆盖。
const frontendDist = process.env.FRONTEND_DIST || path.join(ctx.BACKEND_ROOT, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// ── 全局错误处理（兜底未捕获异常，统一输出 { error, code, requestId }）──
app.use(errorHandler);

// ── 启动 ──
runtime.ensureSeed();
require('./extensions/manager').ensureDefaults();

// 每日自动快照调度（可用 MULTICHAT_AUTO_SNAPSHOT=0 关闭）
require("./runtime/auto-snapshot").startAutoSnapshots();
const server = app.listen(PORT, HOST, () => {
  console.log(`Multi-model chat server running on http://${HOST}:${PORT}`);
  if (access.auto) console.log('访问保护：已自动生成令牌，同源页面通过 /api/session 领取（MULTICHAT_NO_AUTH=1 可关闭）');
  else if (!apiToken && !basicAuth) console.warn('访问保护：鉴权已显式关闭，请确认仅在可信本机环境使用');
  if (!strictHostCheck) console.warn(`访问保护：监听 ${HOST}（非回环），Host 白名单未强制，请配置反向代理与令牌`);
  console.log(`OpenAI-compatible endpoint: POST /v1/chat/completions`);
  console.log(`Agent endpoint:           POST /api/agents/:id/chat`);
});

function shutdown(signal) {
  console.log(`${signal}: closing MCP clients and HTTP server`);
  ctx.closeAllMcpClients();
  server.close(() => {
    ctx.store.close?.();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
