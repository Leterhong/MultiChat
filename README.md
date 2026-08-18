<div align="center">

# MultiChat

**一个本地优先的多模型 Agent 工作台 + OpenAI 兼容网关**

本地优先 · 无登录 · 无计费 · 配置自托管

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-412991?logo=openai&logoColor=white)](https://platform.openai.com/docs/api-reference)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088ff?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)

[快速开始](#-快速开始) · [功能特性](#-核心特性) · [Agent 安全](#-agent-安全审批流与-mcp-信任等级) · [支持的模型](#-支持的模型) · [API 兼容](#-api-兼容) · [项目结构](#-项目结构) · [开发](#-开发)

</div>

---

## ✨ 核心特性

| 类别 | 能力 |
|------|------|
| **协议** | 完全兼容 OpenAI `/v1/chat/completions`（含流式 SSE、`tools`/`tool_choice`、`temperature`/`max_tokens`/`top_p` 等 14 个标准字段透传） |
| **多模型** | 内置 OpenAI / DeepSeek / Anthropic / Gemini / Kimi / 智谱 / 通义千问 / Ollama / LM Studio 等模板，支持任意 OpenAI 兼容端点 |
| **Agent 工作台** | 工作区 → 项目 → 会话三层组织；智能体、技能、插件、MCP、运行记录统一在一个工作区里组合 |
| **Agent 安全** | 工具调用可触发 **Approval 审批流**（人工批准后才执行）；MCP 插件分 **trusted / untrusted** 信任等级，远程 MCP 默认关闭 |
| **本地优先** | Providers / 对话 / Agent / Skill / Plugin / Run / 工作区全部存本机 JSON，零云依赖 |
| **零门槛** | 无登录、无注册、无计费、无配额，开箱即用 |
| **可扩展底座** | Node.js + Express，适配器、存储、清单校验、MCP 客户端、SSRF 防护和测试分层 |
| **工程化** | 前端 Vite 工程化（core + 12 业务模块）；GitHub Actions 双 job（后端测试 + 前端构建）；ESLint / Prettier 质量门禁 |
| **Docker** | 提供 Dockerfile + docker-compose，开箱可部署 |

---

## 🧭 产品定位

MultiChat 现在不只是一个“切换模型的聊天页面”，而是一个面向个人开发者和小团队的本地 Agent 工作台：

- **模型层**：统一接入云端、本地和自建 OpenAI 兼容模型。
- **能力层**：把 Prompt 技能、可执行工具和 MCP 工具组合成可复用 Skill。
- **智能体层**：用系统提示词 + Skill 绑定出研究、写作、开发、测试、安全等 Agent。
- **组织层**：用 **工作区 / 项目 / 会话** 把上面的资源分层归档，避免混乱。
- **安全层**：Agent 调用高风险工具时走 **Approval 审批流**，MCP 插件按 **信任等级** 沙箱化。
- **运行层**：保留 Agent 运行状态、步骤、工具调用、审批轨迹和错误，方便复盘问题。

---

## 🚀 快速开始

### 方式 1：直接运行（最快）

```bash
# 1. 克隆
git clone https://github.com/Leterhong/MultiChat.git && cd MultiChat

# 2. 启动后端（Express，只需 express + cors 两个运行时依赖）
cd backend && npm install && npm start
# → Multi-model chat server running on http://localhost:3000
# → OpenAI-compatible endpoint: POST /v1/chat/completions
```

前端 `frontend/dist` 已随仓库提交（由 Vite 构建生成），`server.js` 直接静态托管，因此克隆后访问 `http://localhost:3000` 即可使用，无需再构建前端。

> 如果你改动了 `frontend/src` 下的源码，需要重新构建：
> ```bash
> cd frontend && npm install && npm run build   # 产物输出到 frontend/dist
> ```

运行后可执行后端测试套件，验证普通聊天、Agent 流式、审批流、文件上下文注入：

```bash
cd backend && npm test
```

打开 `http://localhost:3000`，点右上角 ⚙ 设置 → 添加一个模型（填入你的 API Key 和 baseUrl）即可开始对话。

### 方式 2：Docker

```bash
docker-compose up -d
# 访问 http://localhost:3000
```

### 方式 3：作为 OpenAI 兼容代理（让任何 ChatGPT 客户端接入）

MultiChat 的 `/v1/chat/completions` 与 OpenAI 协议完全兼容，**任何支持自定义 baseUrl 的客户端都可以指向它**：

```bash
# 客户端配置
base_url: http://localhost:3000/v1
api_key: 任意非空字符串（请求体里会带上 _provider，覆盖实际密钥）
model:    openai:gpt-4o-mini    # 格式：<providerId>:<modelName>
```

或者直接用 `body._provider` 字段把 provider 配置整体内嵌进请求体（前端默认走这个路径），完全不需要预先在 MultiChat 里存 provider 记录。

远程 URL 导入默认允许技能包、智能体包和纯 Prompt 插件；会执行外部进程的远程 MCP 插件默认关闭。只有在可信环境中明确设置 `MULTICHAT_ALLOW_REMOTE_MCP=1` 才会启用。

---

## 🤖 支持的模型

内置 9 个常用供应商模板，一键填入 API Key 即可使用：

| 供应商 | 协议 | 默认 baseUrl | 适配器 |
|--------|------|--------------|--------|
| OpenAI | openai | `https://api.openai.com/v1` | `openai` |
| DeepSeek | openai | `https://api.deepseek.com/v1` | `openai` |
| Anthropic | anthropic | `https://api.anthropic.com/v1` | `anthropic` |
| Google Gemini | openai | `https://generativelanguage.googleapis.com/v1beta/openai` | `openai` |
| 月之暗面 Kimi | openai | `https://api.moonshot.cn/v1` | `openai` |
| 智谱 GLM | zhipu | `https://open.bigmodel.cn/api/paas/v4` | `zhipu` |
| 阿里云 DashScope | openai | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `openai` |
| Ollama (本地) | ollama | `http://localhost:11434/v1` | `ollama` |
| LM Studio (本地) | lmstudio | `http://localhost:1234/v1` | `lmstudio` |

> 任何 OpenAI 兼容端点（包括自建网关、转发代理）都可以通过"自定义 Provider"添加，协议类型选 `openai` 即可。

---

## 📡 API 兼容

### `POST /v1/chat/completions`

完全兼容 OpenAI 协议。请求示例：

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek:deepseek-chat",
    "messages": [{"role":"user","content":"你好"}],
    "stream": true,
    "temperature": 0.7,
    "max_tokens": 2048
  }'
```

#### `model` 字段格式

```
<providerId>:<modelName>
```

- `providerId`：在 MultiChat 设置中添加的 Provider ID（或在请求体中通过 `_provider.id` 提供）
- `modelName`：该 Provider 下的模型名（Ollama 模型名可含冒号，如 `llama3:latest`）

#### `_provider` 字段（MultiChat 扩展）

为支持客户端代理场景，MultiChat 接受请求体中的 `_provider` 字段（OpenAI 协议外扩展），用于在请求级注入 Provider 配置：

```json
{
  "model": "openai:gpt-4o-mini",
  "messages": [...],
  "_provider": {
    "id": "openai",
    "name": "OpenAI",
    "apiType": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-..."
  }
}
```

字段说明：
- `id`、`name`：仅作标识，不影响路由
- `apiType`：`openai` / `anthropic` / `ollama` / `lmstudio` / `zhipu` / `wenxin`
- `baseUrl`：上游 API 根地址（不含尾部 `/`）
- `apiKey`：上游鉴权密钥
- `models`：可选，列出可用模型（仅供前端选择器显示）

#### 透传字段

以下 OpenAI 标准字段完全透传至上游：
`temperature` · `max_tokens` · `top_p` · `tools` · `tool_choice` · `stream_options` · `response_format` · `logprobs` · `stop` · `frequency_penalty` · `presence_penalty` · `seed` · `n` · `user` · `parallel_tool_calls`

### 其他端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/providers` | 列出所有 Provider |
| POST | `/api/providers` | 新增 Provider |
| PUT | `/api/providers/:id` | 更新 Provider |
| DELETE | `/api/providers/:id` | 删除 Provider |
| GET | `/api/models` | 列出所有 Provider × 模型组合 |
| POST | `/api/fetch-local-models` | 拉取 Ollama / LM Studio 本地模型 |
| GET / POST / PUT / DELETE | `/api/conversations[/:id[/messages]]` | 对话 CRUD |
| GET / POST / PUT / DELETE | `/api/prompts`、`/api/assistants` | 提示词 / 助手 CRUD |
| GET / POST / PUT / DELETE | `/api/skills`、`/api/agents` | Skill / Agent CRUD |
| GET / POST | `/api/plugins`、`/api/import` | 插件发现、安装、启停、文件或 URL 导入 |
| GET / POST / PUT / DELETE | `/api/workspaces[/:id]` | 工作区 / 项目 / 会话分层管理 |
| GET / POST | `/api/runs[/:id]` | Agent 运行历史与状态 |
| POST | `/api/runs/:id/approval/:approvalId` | 审批流：批准 / 拒绝某个工具调用（`approve` / `reject`） |
| GET | `/api/runtime`、`/api/catalog` | 工作台能力和完整目录 |
| GET | `/api/health` | 健康检查（Docker / LB 用） |

#### 审批相关 SSE 事件

Agent 运行期间，服务端通过 SSE 推送审批事件（前端据此渲染审批卡片）：

- `approval_required`：某个工具调用需要人工批准，附带 `approvalId`、工具名、参数摘要
- `approval_resolved`：审批已处理（`approved` / `rejected`），Agent 继续执行或中止

---

## 🔐 Agent 安全：审批流与 MCP 信任等级

MultiChat 在把 Agent 能力开放给可执行工具 / MCP 时，内置了两道防线：

**1. Approval 审批流**

Agent 执行链路中，当某个工具调用命中「需要人工确认」的策略时，运行会被挂起并向前端推送 `approval_required` 事件；用户在卡片上点击批准或拒绝后，前端调用 `POST /api/runs/:id/approval/:approvalId`（`{ action: "approve" | "reject" }`），服务端用 `approval_resolved` 事件唤醒挂起的任务。审批轨迹会记录在 Run 的 `approvals` 字段里，方便事后复盘。超时（默认 5 分钟）或取消信号会安全中止挂起任务。

**2. MCP 信任等级**

每个 MCP 插件都带一个信任等级：

- `trusted`：本地受信插件，可正常加载与调用。
- `untrusted`：默认沙箱化，远程会执行外部进程的 MCP 插件在此等级下默认关闭，仅当显式设置 `MULTICHAT_ALLOW_REMOTE_MCP=1` 才允许。

Agent 执行引擎（`backend/runtime/agent.js`）会根据 `trustLevel(skill)`、`requiresApproval(skill, policy)`、`riskLevel(perms)` 动态决定是否挂起审批、是否放行 MCP 调用。

---

## 🗂️ 工作区 / 项目 / 会话

为应对「多 Agent、多任务」带来的资源混乱，MultiChat 用三层结构组织资源：

- **工作区（Workspace）**：最高层级容器，聚合一组相关的 Provider、Agent、Skill、Plugin 与运行记录。
- **项目（Project）**：工作区下的子分组，用于隔离不同目标（例如「论文写作」「代码审查」）。
- **会话（Session）**：项目下的一次具体对话，带独立的消息历史与上下文。

对应的存储与路由在 `backend/lib/workspace-store.js` 与 `backend/routes/workspaces.js`，前端在侧边栏提供工作区 / 项目 / 会话的切换与 CRUD。

---

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────┐
│          浏览器 (Vite 前端工程)                │
│   frontend/src → vite build → frontend/dist   │
│   core（dom/toast/state/api）+ 12 业务模块    │
└────────────────┬─────────────────────────────┘
                 │ HTTP / SSE
┌────────────────▼─────────────────────────────┐
│       Node.js 后端 (可扩展模块化底座)          │
│   Express + 适配器 + JSON Store + MCP         │
│   routes/ · runtime/agent.js · lib/ · SSRF   │
│   OpenAI / Anthropic / Ollama / LM Studio    │
│   Zhipu / Wenxin / ...                       │
└────────────────┬─────────────────────────────┘
                 │ HTTPS
┌────────────────▼─────────────────────────────┐
│       上游 LLM 提供商                         │
│   OpenAI / DeepSeek / Anthropic / ...        │
│   或自建 OpenAI 兼容网关 / Ollama 本地        │
└──────────────────────────────────────────────┘
```

| 层 | 技术选型 |
|----|----------|
| 前端 | Vite 工程化；原生 HTML + CSS + JS，按 `core` + `modules` 拆分为 13 个源文件，构建产物在 `frontend/dist` |
| 后端 | Node.js 18+，Express 4，仅 2 个运行时依赖（`express` + `cors`） |
| 存储 | 本地 JSON 文件（`backend/data/`），零数据库依赖 |
| 协议 | OpenAI `/v1/chat/completions` 完整兼容 |
| 质量 | GitHub Actions（后端测试 + 前端构建）、ESLint、Prettier、后端测试套件 |

---

## 📁 项目结构

```
MultiChat/
├── backend/                      # Express 后端（模块化 Agent 平台）
│   ├── server.js                 # 入口：挂载路由 + 静态托管 frontend/dist
│   ├── mcp.js                    # MCP 客户端与信任等级判定
│   ├── adapters/                 # 供应商适配器（工厂模式）
│   │   ├── index.js  base.js     #   工厂 + 基类
│   │   ├── openai.js  anthropic.js
│   │   ├── ollama.js  lmstudio.js
│   │   ├── zhipu.js  wenxin.js  moonshot.js  qwen.js
│   │   └── README.md
│   ├── lib/                      # 基础设施
│   │   ├── store.js              #   JSON 存储
│   │   ├── workspace-store.js    #   工作区 / 项目 / 会话存储
│   │   ├── context.js            #   文件上下文注入 + 审批挂起句柄
│   │   ├── catalog.js            #   能力目录
│   │   ├── errors.js             #   统一错误码
│   │   ├── ssrf.js               #   SSRF 防护（拦截内网/元数据地址）
│   │   └── util.js
│   ├── routes/                   # 路由层（11 个）
│   │   ├── chat.js  agents.js  assistants.js  conversations.js
│   │   ├── skills.js  plugins.js  providers.js  runs.js
│   │   ├── workspaces.js  import.js  meta.js
│   ├── runtime/
│   │   └── agent.js              # Agent 执行引擎（审批 / 信任 / MCP）
│   ├── marketplace/              # 市场清单（skills / agents / plugins.json）
│   ├── plugins/                  # 本地插件示例（含 demo-time-mcp 等）
│   └── tests/                    # 测试套件
│       ├── smoke.js              #   普通聊天 / Agent 流式 / 导入 / 运行记录
│       ├── approval.js           #   审批流端到端
│       └── filecontext.js        #   文件上下文注入语义
├── frontend/                     # Vite 前端工程
│   ├── index.html                # Vite 入口
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.js               # 聚合层（挂载 core/modules 到 globalThis）
│   │   ├── core/                 # 基础设施
│   │   │   ├── dom.js  toast.js  state.js  api.js  index.js
│   │   ├── modules/              # 12 个业务模块
│   │   │   ├── init.js  data.js  conversations.js  modelPicker.js
│   │   │   ├── agentPicker.js  settings.js  pluginsUI.js  importExport.js
│   │   │   ├── modal.js  render.js  markdown.js  send.js
│   │   └── styles.css
│   └── dist/                     # 构建产物（已提交，server 直接 serve）
├── .github/workflows/ci.yml      # CI：backend 测试 + frontend 构建 / lint
├── Dockerfile  docker-compose.yml  deploy.sh
└── README.md
```

---

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `DATA_DIR` | `backend/data` | 数据存储目录（providers / conversations / 工作区 / 等） |
| `MULTICHAT_ALLOW_REMOTE_MCP` | `0` | 置 `1` 才允许加载会执行外部进程的远程 MCP 插件 |

---

## ➕ 添加自定义 Provider

**方式 1：通过 UI（推荐）**

1. 打开 `http://localhost:3000`
2. 点击右上角 ⚙ 设置
3. 在"模型"标签点击 "+ 添加 Provider"
4. 填写：名称、API 地址、API Key、模型列表（每行一个）
5. 保存后即可在主界面选择该 Provider 的任意模型

**方式 2：直接编辑 `backend/data/providers.json`**

```json
[
  {
    "id": "my-proxy",
    "name": "我的代理",
    "apiType": "openai",
    "baseUrl": "https://my-proxy.example.com/v1",
    "apiKey": "sk-xxx",
    "models": ["gpt-4o-mini", "claude-3-5-sonnet"]
  }
]
```

保存后无需重启，前端会在下次拉取时加载。

---

## 🔌 编写新适配器

在 `backend/adapters/` 下新增一个文件，实现以下接口：

```js
// backend/adapters/myvendor.js
const MyAdapter = {
  apiType: 'myvendor',                          // 唯一标识
  async prepare() { /* 鉴权准备（如获取 access_token） */ },
  getEndpoint() { return 'https://api.myvendor.com/v1/chat'; },
  getHeaders() { return { 'Authorization': 'Bearer ' + this.apiKey }; },
  buildRequestBody(model, messages, stream, extra) {
    return { model, messages, stream, ...extra };
  },
  transformResponse(data) { return data; },     // 标准化为 OpenAI 格式
  transformSSEChunk(line) { return null; },     // 解析 SSE 行，返回 OpenAI chunk
};
module.exports = MyAdapter;
```

然后在 `backend/adapters/index.js` 的工厂里注册：

```js
const myvendor = require('./myvendor');
// ...
const map = { openai, anthropic, ollama, lmstudio, zhipu, wenxin, moonshot, qwen, myvendor };
return Object.create(map[apiType] || map.openai);
```

---

## 🛠️ 开发

**后端**

```bash
cd backend
npm install
npm test        # 运行 smoke / approval / filecontext 三套测试
npm run lint    # ESLint（错误阻断，警告允许）
```

**前端（Vite 工程）**

```bash
cd frontend
npm install
npm run dev      # 本地开发服务器（热更新）
npm run build    # 构建到 frontend/dist（部署用）
npm run lint     # ESLint
npm run format   # Prettier 格式化
```

`server.js` 直接静态托管 `frontend/dist`，因此本地联调时后端 `npm start` 即可同时提供 API 与页面。

**CI**

推送到 `main` 或发起 PR 时，GitHub Actions 会并行运行：

- `backend` job：安装依赖 → `npm test` → 对所有模块做 `node --check` 语法检查 → `npm run lint`
- `frontend` job：`npm ci` → `npm run build` → `npm run lint`

---

## 🐳 Docker

```bash
docker-compose up -d          # 启动
docker-compose logs -f        # 实时日志
docker-compose down           # 停止
PORT=8080 docker-compose up   # 自定义端口
```

---

## 🧯 常见问题

**Q: 添加了 Provider 但模型下拉里看不到？**
A: Provider 的 `models` 字段必须是非空数组。在 settings 卡片里编辑该 Provider，确保"模型列表"里至少有一行。

**Q: 发送消息后报 `HTTP 403`？**
A: 这是**上游服务商**返回的（不是 MultiChat）。常见原因：① API Key 无效或被禁用；② 余额不足；③ 模型名不存在；④ IP 地区受限。多模型聊天界面会显示友好的中文错误提示，可直接在气泡里查看具体原因。

**Q: Ollama / LM Studio 怎么用？**
A: 确保本地服务已启动（Ollama 监听 11434、LM Studio 监听 1234），在设置里添加对应 Provider，API Key 留空即可。

**Q: 数据存在哪？**
A: `backend/data/` 目录下的 JSON 文件（含对话、Provider、工作区等）。可直接备份、迁移。

**Q: Agent 工具调用一直卡着？**
A: 该工具调用命中了 Approval 审批策略，正在等待你在对话界面的审批卡片上「批准 / 拒绝」。超时（默认 5 分钟）会自动中止。

**Q: 怎么让现有 ChatGPT 客户端（Cherry Studio / ChatBox / NextChat 等）通过 MultiChat 转发？**
A: 在客户端里设置 `base_url = http://localhost:3000/v1`，模型名写 `<providerId>:<modelName>`，API Key 随便填一个非空值（真正 Key 由 `_provider.apiKey` 覆盖；如果你的客户端不发送 `_provider` 字段，则需要在 MultiChat 设置里添加对应 Provider）。

---

## 📜 架构与历史

MultiChat 原本基于 [Leterhong/MultiChat](https://github.com/Leterhong/MultiChat) 的"多模型 + 计费"商业版本，本次重构**完全开源化**：

- ❌ 移除：ClawTip 支付集成、用户注册/登录、JWT 鉴权、余额系统、计费中间件
- ❌ 移除：`bcryptjs` / `jsonwebtoken` / `http-proxy` 等 3 个 npm 依赖
- ✅ 保留：OpenAI 兼容代理 + 适配器工厂 + Providers / 对话 / Prompts / Assistants 本地存储
- ✅ 优化：14 个 OpenAI 标准字段完全透传、`tools` / `tool_choice` 自动补 `auto`、结构化错误提示
- ✅ 新增：工作区 / 项目 / 会话分层、Agent 审批流 + MCP 信任等级、Vite 前端工程化、后端测试套件与 CI

---

## 📄 License

[MIT](LICENSE)
