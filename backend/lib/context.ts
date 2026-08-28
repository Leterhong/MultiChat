'use strict';
// ── 共享上下文（单例）：集中依赖与常量，避免每个路由重复 require / 重复定义 ──
// 注意：本模块在 require 时构造 store / workspaceStore，均为本地 IO，不启动服务，
// 因此可被 routes / services / plugins 各层安全依赖，无循环依赖。
const fs = require('fs');
const path = require('path');
const { getMcpClient, closeMcpClient, closeAllMcpClients } = require('../mcp');
const { createRuntimeStore } = require('./runtime-store');
const { createWorkspaceStore } = require('./workspace-store');
const { createProviderStore } = require('./provider-store');
const { safeFetch } = require('./ssrf');
const { createAdapter, ADAPTER_MAP } = require('../adapters');
const { readPackageVersion, safeId } = require('./catalog');

const PORT = process.env.PORT || 3000;
const BACKEND_ROOT = path.basename(__dirname) === 'lib' && path.basename(path.dirname(__dirname)) === 'dist'
  ? path.dirname(path.dirname(__dirname))
  : path.dirname(__dirname);
const DATA_DIR = process.env.DATA_DIR || path.join(BACKEND_ROOT, 'data');
const runtimeStore = createRuntimeStore(DATA_DIR);
const store = runtimeStore.store;
const STORAGE_FALLBACK = runtimeStore.fallbackReason ? 'json' : null;
const workspaceStore = createWorkspaceStore(store);
const providerStore = createProviderStore(store);
const VERSION = readPackageVersion();

// 插件 / 技能 / 智能体 / 运行 相关常量（原 server.ts 顶层常量集中于此）
const SKILL_FILE = 'skills.json';
const AGENT_FILE = 'agents.json';
const RUN_FILE = 'runs.json';
const MAX_RUNS = 200;

// 运行中的 Agent 任务取消句柄：runId → AbortController。
// 用于「Cancellation」：前端停止时，后端能真正中断上游 fetch 与 MCP 子进程。
const runAborts = new Map();

module.exports = {
  fs,
  path,
  getMcpClient,
  closeMcpClient,
  closeAllMcpClients,
  BACKEND_ROOT,
  store,
  workspaceStore,
  providerStore,
  safeFetch,
  createAdapter,
  ADAPTER_MAP,
  readPackageVersion,
  safeId,
  PORT,
  DATA_DIR,
  STORAGE_FALLBACK,
  VERSION,
  SKILL_FILE,
  AGENT_FILE,
  RUN_FILE,
  MAX_RUNS,
  runAborts,
};
