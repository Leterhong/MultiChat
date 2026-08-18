'use strict';
// ── MultiChat Agent Workspace · 应用装配入口 ───────────────────────────
// 本文件只负责：加载共享上下文、注册中间件、挂载各路由模块、托管前端静态资源、
// 注册全局错误处理、执行数据种子、监听端口。具体业务逻辑已拆分到：
//   routes/    —— 各 REST 端点（providers / conversations / workspaces /
//                assistants / runs / skills / agents / plugins / import / chat / meta）
//   runtime/   —— Agent 运行时核心（技能 / 智能体 / 运行）
//   plugins/   —— 插件管理（本地市场 + MCP 连接器）
//   lib/       —— 存储、SSRF、catalog、workspace-store、统一错误码、共享上下文
const express = require('express');
const cors = require('cors');
const path = require('path');

const ctx = require('./lib/context');
const { requestIdMiddleware, errorHandler } = require('./lib/errors');
const runtime = require('./runtime/agent');

const app = express();
const PORT = ctx.PORT;

// ── 基础中间件 ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// 市场内容包（技能/智能体/插件），以真实 URL 提供，供 URL 导入一键拉取
app.use('/marketplace', express.static(path.join(__dirname, 'marketplace')));
// 统一请求ID：每个请求分配 id 并写入响应头 X-Request-Id（A3）
app.use(requestIdMiddleware);

// ── 路由注册 ──
require('./routes/providers')(app);
require('./routes/conversations')(app);
require('./routes/workspaces')(app);
require('./routes/assistants')(app);
require('./routes/runs')(app);
require('./routes/skills')(app);
require('./routes/agents')(app);
require('./routes/plugins')(app);
require('./routes/import')(app);
require('./routes/chat')(app);
require('./routes/meta')(app);

// ── 前端静态资源（单文件 SPA 生产件） ──
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// ── 全局错误处理（兜底未捕获异常，统一输出 { error, code, requestId }）──
app.use(errorHandler);

// ── 启动 ──
runtime.ensureSeed();

app.listen(PORT, () => {
  console.log(`Multi-model chat server running on http://localhost:${PORT}`);
  console.log(`OpenAI-compatible endpoint: POST /v1/chat/completions`);
  console.log(`Agent endpoint:           POST /api/agents/:id/chat`);
});
