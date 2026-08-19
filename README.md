<div align="center">

# MultiChat

**本地优先的多模型 Agent 工作台 + OpenAI 兼容网关**

本地优先 · 无登录 · 无计费 · 配置自托管

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-412991?logo=openai&logoColor=white)](https://platform.openai.com/docs/api-reference)
[![CI](https://github.com/Leterhong/MultiChat/actions/workflows/ci.yml/badge.svg)](https://github.com/Leterhong/MultiChat/actions/workflows/ci.yml)

[快速开始](#-快速开始) · [技能包 (.zip)](#-技能包zip) · [支持的模型](#-支持的模型) · [API](#-api) · [安全设计](#-安全设计) · [项目结构](#-项目结构) · [开发](#-开发)

</div>

---

## ✨ 核心特性

| 类别 | 能力 |
|------|------|
| **协议** | 完整兼容 OpenAI `/v1/chat/completions`（流式 SSE、`tools`/`tool_choice`、14+ 标准字段透传，`_provider` 请求级注入） |
| **多模型** | 内置 OpenAI / DeepSeek / Anthropic / Gemini / Kimi / 智谱 / 通义千问 / Ollama / LM Studio 模板，任意 OpenAI 兼容端点可自定义接入 |
| **Agent 工作台** | 工作区 → 项目 → 会话三层组织；智能体、技能、插件、MCP、运行记录统一编排 |
| **技能系统** | 技能 = 自包含 **`.zip` 技能包**（manifest + 资源文件），支持文件上传 / URL 直链导入，七道安全校验后才落盘加载 |
| **Agent 安全** | 高风险工具调用走 **Approval 审批流**（人工批准后才执行）；MCP 插件分 **trusted / untrusted** 信任等级，远程 MCP 默认关闭 |
| **本地优先** | Providers / 对话 / Agent / Skill / Plugin / Run / 工作区全部存本机 JSON，零云依赖，可整体备份迁移 |
| **零门槛** | 无登录、无注册、无计费、无配额，开箱即用 |
| **工程化** | 前端 Vite + TypeScript（core + 12 业务模块）；后端 Node.js + Express（TS 渐进迁移，tsx 运行）；GitHub Actions 双 job CI；ESLint / Prettier / tsc 质量门禁 |
| **部署** | Dockerfile + docker-compose 开箱部署；前端构建产物 `dist/` 随仓库提交，克隆即用 |

---

## 🚀 快速开始

### 方式 1：直接运行（最快）

```bash
git clone https://github.com/Leterhong/MultiChat.git && cd MultiChat

# 启动后端（tsx 运行，兼容 .ts/.js 混合源码）
cd backend && npm install && npm start
# → Multi-model chat server running on http://localhost:3000
# → OpenAI-compatible endpoint: POST /v1/chat/completions
```

前端构建产物 `frontend/dist` 已随仓库提交，`server.js` 直接静态托管，克隆后访问 `http://localhost:3000` 即可使用，无需再构建前端。

> 改了 `frontend/src` 源码后需重新构建：
> ```bash
> cd frontend && npm install && npm run build   # 产物输出到 frontend/dist
> ```

运行后端测试（模块加载 + 技能包安装冒烟）：

```bash
cd backend && npm test
```

打开 `http://localhost:3000`，点右上角 ⚙ 设置 → 添加模型（填入 API Key 与 baseUrl）即可开始对话。

### 方式 2：Docker

```bash
docker-compose up -d
# 访问 http://localhost:3000
```

### 方式 3：作为 OpenAI 兼容代理（让任何 ChatGPT 客户端接入）

MultiChat 的 `/v1/chat/completions` 与 OpenAI 协议完全兼容，任何支持自定义 baseUrl 的客户端（Cherry Studio / ChatBox / NextChat 等）都可以指向它：

```bash
base_url: http://localhost:3000/v1
api_key: 任意非空字符串（真实 Key 由请求体 `_provider` 覆盖）
model:    openai:gpt-4o-mini    # 格式：<providerId>:<modelName>
```

---

## 📦 技能包 (.zip)

技能不再是一条裸 JSON 记录，而是**自包含的压缩包**——上传后由后端解压、安全校验、落盘到 `backend/plugins/<id>/`，技能/智能体经插件管理器注册进 `skills.json` / `agents.json`（带 `_plugin` 标记，可整体卸载）。

### 包内结构

```
my-skill.zip
├── manifest.json          # 必须：包元数据 + skills/agents 定义
├── references/            # 可选：使用文档（.md）
├── assets/                # 可选：模板 / 图片 / 数据（json/svg/png/csv 等）
└── README.md              # 可选
```

### manifest.json 格式

```json
{
  "id": "owner_my_skill",
  "name": "我的技能",
  "type": "bundle",
  "version": "1.0.0",
  "skills": [
    {
      "id": "ts_writer",
      "name": "写作助手",
      "type": "prompt",
      "config": { "prompt": "你是一个专业的中文技术写作助手……" }
    }
  ],
  "agents": [
    { "id": "ag_editor", "name": "编辑 Agent", "description": "负责校对与润色" }
  ]
}
```

- 根 `id` 须匹配 `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$`；`type` 强制为 `bundle`（**禁止 `mcp`**，技能包不启动任何外部进程，杜绝远程代码执行）。
- 技能 `type` 白名单：`prompt` / `datetime` / `calculator` / `web_fetch` / `web_search`；`prompt` 型须含 `config.prompt`（≤ 8000 字）。
- 权限声明仅允许已知集合（如 `network`）。

### 上传方式

| 入口 | 说明 |
|------|------|
| **UI 上传** | 设置 → 导入 / 引用 → 「上传技能包 (.zip)」选择本地文件 |
| **URL 直链** | 设置 → 导入 / 引用 → 「URL 导入」粘贴 `.zip` 直链（后端自动识别 `PK` 魔数 / content-type / 后缀） |
| **API** | `POST /api/import`，`{ format: 'zip', payload: <base64> }` |

### 安全校验（入口即拦，先于任何落盘）

1. **zip-slip 路径穿越防护**：拒绝绝对路径、`..` 段、逃逸 root 的条目
2. **防 zip-bomb**：压缩包 ≤ 8 MB、文件数 ≤ 200、单文件 ≤ 5 MB、解压后总大小 ≤ 20 MB
3. **扩展名白名单**：只放行 `json/md/txt/yaml/svg/png/jpg/gif/webp/html/css/csv/pdf` 等静态资源，禁止 `exe/sh/py/so/dll` 等可执行/脚本文件
4. **manifest 合法性**：根 `id` 经 `safeId` 校验、`name` 必填、`type` 强制归一 `bundle`、技能类型白名单、`prompt` 长度上限、权限声明白名单

校验失败返回 `400 INVALID_PACKAGE`，不做任何写入。

---

## 🤖 支持的模型

内置 9 个常用供应商模板，一键填入 API Key 即可使用：

| 供应商 | 协议 | 默认 baseUrl | 适配器 |
|--------|------|--------------|--------|
| OpenAI | openai | `https://api.openai.com/v1` | `openai` |
| DeepSeek | openai | `https://api.deepseek.com/v1` | `openai` |
| Anthropic | anthropic | `https://api.anthropic.com/v1` | `anthropic` |
| Google Gemini | openai | `https://generativelanguage.googleapis.com/v1beta/openai` | `openai` |
| 月之暗面 Kimi | openai | `https://api.moonshot.cn/v1` | `moonshot` |
| 智谱 GLM | zhipu | `https://open.bigmodel.cn/api/paas/v4` | `zhipu` |
| 阿里云 DashScope | openai | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen` |
| Ollama (本地) | ollama | `http://localhost:11434/v1` | `ollama` |
| LM Studio (本地) | lmstudio | `http://localhost:1234/v1` | `lmstudio` |

> 任何 OpenAI 兼容端点（自建网关、转发代理）可通过「自定义 Provider」添加，协议类型选 `openai` 即可。

---

## 📡 API

### `POST /v1/chat/completions`

完全兼容 OpenAI 协议：

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek:deepseek-chat",
    "messages": [{"role":"user","content":"你好"}],
    "stream": true
  }'
```

**`model` 字段格式**：`<providerId>:<modelName>`（Ollama 模型名可含冒号，如 `llama3:latest`）。

**`_provider` 字段（MultiChat 扩展）**：请求级注入 Provider 配置，适合客户端代理场景，无需预先存 provider 记录：

```json
{
  "model": "openai:gpt-4o-mini",
  "messages": [],
  "_provider": {
    "id": "openai",
    "apiType": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-..."
  }
}
```

**透传字段**：`temperature` · `max_tokens` · `top_p` · `tools` · `tool_choice` · `stream_options` · `response_format` · `logprobs` · `stop` · `frequency_penalty` · `presence_penalty` · `seed` · `n` · `user` · `parallel_tool_calls`

### 其他端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET / POST / PUT / DELETE | `/api/providers[/:id]` | Provider CRUD |
| GET | `/api/models` | 所有 Provider × 模型组合 |
| POST | `/api/fetch-local-models` | 拉取 Ollama / LM Studio 本地模型 |
| GET / POST / PUT / DELETE | `/api/conversations[/:id[/messages]]` | 对话 CRUD |
| GET / POST / PUT / DELETE | `/api/prompts`、`/api/assistants` | 提示词 / 助手 CRUD |
| GET / POST / PUT / DELETE | `/api/skills`、`/api/agents` | Skill / Agent CRUD |
| GET / POST | `/api/plugins` | 插件发现、安装、启停 |
| POST | `/api/import` | 导入：`format: json`（技能/智能体/插件清单）或 `format: zip`（技能包，base64）或 URL 抓取 |
| GET / POST / PUT / DELETE | `/api/workspaces[/:id]` | 工作区 / 项目 / 会话分层管理 |
| GET / POST | `/api/runs[/:id]` | Agent 运行历史与状态 |
| POST | `/api/runs/:id/approval/:approvalId` | 审批流：`{ action: "approve" | "reject" }` |
| GET | `/api/runtime`、`/api/catalog` | 工作台能力与完整目录 |
| GET | `/api/health` | 健康检查（Docker / LB 用） |

**审批 SSE 事件**：Agent 运行期间服务端推送 `approval_required`（待审批工具调用）与 `approval_resolved`（审批结果），前端据此渲染审批卡片。

---

## 🔐 安全设计

1. **Approval 审批流**：Agent 执行命中「需人工确认」策略时挂起运行，推送 `approval_required`；用户批准/拒绝后由 `approval_resolved` 唤醒。审批轨迹记录在 Run 的 `approvals` 字段，超时（默认 5 分钟）自动中止。

2. **MCP 信任等级**：
   - `trusted`：本地受信插件，正常加载调用。
   - `untrusted`：默认沙箱化；远程会执行外部进程的 MCP 插件默认关闭，仅显式设置 `MULTICHAT_ALLOW_REMOTE_MCP=1` 才允许。

3. **技能包上传安全**：见 [技能包 (.zip)](#-技能包zip) 的七道校验——zip-slip 防护、zip-bomb 上限、扩展名白名单、manifest 合法性、强制 `type=bundle` 禁 `mcp`（防远程代码执行）。

4. **SSRF 防护**：后端 URL 抓取走 `safeFetch`，拦截内网 / 云元数据地址（`lib/ssrf.ts`）。

执行引擎 `backend/runtime/agent.js` 根据 `trustLevel` / `requiresApproval` / `riskLevel` 动态决定是否挂起审批、是否放行 MCP 调用。

---

## 🗂️ 工作区 / 项目 / 会话

- **工作区（Workspace）**：最高层级容器，聚合相关 Provider、Agent、Skill、Plugin 与运行记录。
- **项目（Project）**：工作区下子分组，隔离不同目标（如「论文写作」「代码审查」）。
- **会话（Session）**：项目下的一次具体对话，独立消息历史与上下文。

存储与路由：`backend/lib/workspace-store.js`、`backend/routes/workspaces.js`；前端侧边栏提供切换与 CRUD。

---

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────┐
│          浏览器 (Vite + TypeScript 前端)      │
│   frontend/src → vite build → frontend/dist   │
│   core（dom/toast/state/api）+ 12 业务模块    │
└────────────────┬─────────────────────────────┘
                 │ HTTP / SSE
┌────────────────▼─────────────────────────────┐
│        Node.js 后端 (Express，tsx 运行)        │
│   routes/ · runtime/agent.js · lib/          │
│   adapters/（工厂模式，10 个供应商）           │
│   lib/skillpack.js（.zip 解压 + 安全校验）     │
└────────────────┬─────────────────────────────┘
                 │ HTTPS
┌────────────────▼─────────────────────────────┐
│       上游 LLM 提供商 / 本地模型              │
│   OpenAI / DeepSeek / Anthropic / Ollama ... │
└──────────────────────────────────────────────┘
```

| 层 | 技术选型 |
|----|----------|
| 前端 | Vite + TypeScript；原生 DOM，`core` + 12 个 `modules` 模块；构建产物 `frontend/dist` |
| 后端 | Node.js 18+，Express 4，`tsx` 运行（TS 渐进迁移，`.ts`/`.js` 混合） |
| 存储 | 本地 JSON 文件（`backend/data/`），零数据库依赖 |
| 协议 | OpenAI `/v1/chat/completions` 完整兼容 |
| 质量 | GitHub Actions（后端测试 + 前端构建）、ESLint、Prettier、`tsc --noEmit` |

---

## 📁 项目结构

```
MultiChat/
├── backend/                      # Express 后端（模块化 Agent 平台）
│   ├── server.js                 # 入口：挂载路由 + 静态托管 frontend/dist
│   ├── mcp.js                    # MCP 客户端与信任等级判定
│   ├── adapters/                 # 供应商适配器（工厂模式）
│   │   ├── index.js  base.js
│   │   ├── openai.js  anthropic.js  ollama.js  lmstudio.js
│   │   ├── zhipu.js  wenxin.js  moonshot.js  qwen.js
│   │   └── README.md
│   ├── lib/                      # 基础设施（.ts/.js 混合）
│   │   ├── store.js  workspace-store.js      # JSON / 工作区存储
│   │   ├── context.js  catalog.js  errors.ts # 上下文 / 目录 / 错误码
│   │   ├── ssrf.ts  util.ts                  # SSRF 防护 / 工具
│   │   └── skillpack.js                      # .zip 技能包解压 + 安全校验（核心）
│   ├── routes/                   # 路由层（11 个）
│   │   ├── chat.js  agents.js  assistants.js  conversations.js
│   │   ├── skills.js  plugins.js  providers.js  runs.js
│   │   ├── workspaces.js  import.js  meta.js
│   ├── runtime/
│   │   └── agent.js              # Agent 执行引擎（审批 / 信任 / MCP）
│   ├── marketplace/              # 市场清单（skills / agents / plugins.json）
│   └── plugins/                  # 本地插件目录（demo-time-mcp 等，技能包也落盘于此）
├── frontend/                     # Vite + TypeScript 前端
│   ├── index.html  vite.config.*
│   ├── src/
│   │   ├── main.ts               # 聚合层（core/modules 挂载到 globalThis）
│   │   ├── globals.d.ts          # globalThis 全局符号声明
│   │   ├── core/                 # dom.ts toast.ts state.ts api.ts index.ts
│   │   ├── modules/              # 12 个业务模块（含 importExport.ts 技能包上传）
│   │   └── styles.css
│   └── dist/                     # 构建产物（已提交，server 直接 serve）
├── .github/workflows/ci.yml      # CI：backend 测试 + frontend 构建 / 类型 / lint
├── Dockerfile  docker-compose.yml  deploy.sh
└── README.md
```

---

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `DATA_DIR` | `backend/data` | 数据存储目录（providers / conversations / 工作区等） |
| `MULTICHAT_ALLOW_REMOTE_MCP` | `0` | 置 `1` 才允许加载会执行外部进程的远程 MCP 插件 |

---

## 🛠️ 开发

**后端**

```bash
cd backend
npm install
npm test          # 模块加载 + 技能包安装/卸载冒烟（无测试目录，脚本内联）
npm run lint      # ESLint（错误阻断，警告允许）
npm run typecheck # tsc --noEmit（渐进 strict:false）
```

**前端（Vite + TypeScript）**

```bash
cd frontend
npm install
npm run dev       # 本地开发服务器（热更新）
npm run build     # 构建到 frontend/dist（部署用）
npm run typecheck # tsc --noEmit
npm run lint      # ESLint
npm run format    # Prettier 格式化
```

`server.js` 直接静态托管 `frontend/dist`，本地联调时后端 `npm start` 即可同时提供 API 与页面。

**CI**

推送到 `main` 或发起 PR 时，GitHub Actions 并行运行：

- `backend` job：`npm install --no-package-lock` → `npm test` → `npm run typecheck` → `node --check` 全模块语法 → `npm run lint`
- `frontend` job：`npm install --no-package-lock`（忽略 win32 偏见 lock，linux runner 重新解析原生依赖）→ `npm run build` → `npm run typecheck` → `npm run lint`

---

## 🧯 常见问题

**Q: 添加了 Provider 但模型下拉里看不到？**
A: Provider 的 `models` 字段必须是非空数组，在设置卡片里确保「模型列表」至少一行。

**Q: 发送消息后报 `HTTP 403`？**
A: 这是**上游服务商**返回的。常见原因：API Key 无效/被禁用、余额不足、模型名不存在、IP 地区受限。界面气泡会显示具体中文错误。

**Q: Ollama / LM Studio 怎么用？**
A: 确保本地服务已启动（Ollama 11434、LM Studio 1234），设置里添加对应 Provider，API Key 留空。

**Q: 数据存在哪？**
A: `backend/data/` 目录下的 JSON 文件，可直接备份、迁移。

**Q: Agent 工具调用一直卡着？**
A: 命中了 Approval 审批策略，正在等待你在对话界面审批卡片上「批准 / 拒绝」。超时（默认 5 分钟）自动中止。

**Q: 上传 .zip 技能包被拒？**
A: 返回 `400 INVALID_PACKAGE` 时查看具体原因——通常是路径穿越、文件超限、含禁用扩展名、manifest 缺 id/name、技能类型不在白名单或误用 `mcp` 类型。

**Q: 怎么让现有 ChatGPT 客户端通过 MultiChat 转发？**
A: 客户端设置 `base_url = http://localhost:3000/v1`，模型名写 `<providerId>:<modelName>`，API Key 填非空值；真实 Key 由 `_provider` 字段覆盖。

---

## 📄 License

MIT
