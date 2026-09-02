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

const ctx = require('./lib/context');
const { requestIdMiddleware, errorHandler } = require('./lib/errors');
const runtime = require('./runtime/agent');

const app = express();
const PORT = ctx.PORT;
const HOST = process.env.HOST || '127.0.0.1';

// ── 基础中间件 ──
const corsOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
if (corsOrigins.length) app.use(cors({ origin: corsOrigins, credentials: false }));
// Extension packages are transported as Base64 JSON so the API stays usable
// behind the same reverse proxies as the rest of MultiChat.  The importer
// applies a stricter 20 MB compressed / 80 MB unpacked limit of its own.
app.use(express.json({ limit: '32mb' }));
const apiToken = String(process.env.MULTICHAT_API_TOKEN || process.env.MC_API_TOKEN || '');
const basicAuth = String(process.env.MULTICHAT_BASIC_AUTH || '');
function equalSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
app.use((req, res, next) => {
  if ((!apiToken && !basicAuth) || (!req.path.startsWith('/api/') && !req.path.startsWith('/v1/')) || req.path === '/api/health') return next();
  const authorization = String(req.headers.authorization || '');
  const bearerOk = apiToken && authorization.startsWith('Bearer ') && equalSecret(authorization.slice(7), apiToken);
  const basicOk = basicAuth && authorization.startsWith('Basic ') && equalSecret(Buffer.from(authorization.slice(6), 'base64').toString('utf8'), basicAuth);
  if (bearerOk || basicOk) return next();
  res.setHeader('WWW-Authenticate', 'Bearer realm="MultiChat"');
  return res.status(401).json({ error: { message: 'MultiChat access token required' }, code: 'AUTH_REQUIRED' });
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:*");
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

const server = app.listen(PORT, HOST, () => {
  console.log(`Multi-model chat server running on http://${HOST}:${PORT}`);
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
