# MultiChat Orbit

> 面向本地项目的多模型 Agent 工作台：把对话、Agent、Skill、MCP 与 Plugin 放进一个可观察、可审阅、可回滚的运行空间。

MultiChat Orbit 是 MultiChat 的产品界面与交互系统。它不把所有扩展都塞进同一种“插件”概念，而是保留每种能力真实的边界：

- **Agent** 负责组合模型、指令、Skill、内置工具和 MCP server；
- **Skill** 是以 `SKILL.md` 为入口的知识与工作流目录；
- **MCP** 是独立运行的标准工具服务，拥有自己的连接、信任与作用域策略；
- **Plugin** 是以 `.codex-plugin/plugin.json` 为入口的完整 Codex 能力包；
- **Runtime** 负责渐进加载、工具审批、调用记录和资源清理。

项目坚持本地优先：网页和控制面运行在你的机器上，项目扩展保存在项目目录，运行数据默认保存在当前用户目录。需要注意的是，本地优先不代表所有模型推理都在本地完成；当你配置云端模型或远程 MCP 时，请求仍会发送到对应服务。

## 一条命令启动

需要 [Node.js](https://nodejs.org/) 22 或更高版本。

```bash
npx --yes github:Leterhong/MultiChat web
```

这条命令会通过 npm 从 GitHub 下载当前版本并启动**本地服务**，然后打开 `http://127.0.0.1:3000`。它不是远程发布，也不会替你创建公网服务。按 `Ctrl+C` 即可停止，数据会保留在 `~/.multichat/data`。

在一个具体项目中运行时，建议先进入该项目目录；当前目录会作为默认工作区：

```bash
cd my-agent-project
npx --yes github:Leterhong/MultiChat web
```

常用选项：

```bash
# 指定端口，不自动打开浏览器
npx --yes github:Leterhong/MultiChat web --port 3100 --no-open

# 管理另一个项目，并把运行数据放到指定目录
npx --yes github:Leterhong/MultiChat web \
  --workspace ./my-agent-project \
  --data-dir ./.multichat-data
```

未来发布正式 npm 包后，会补充更短的 `npx @leterhong/multichat web`；在此之前，请以本节的 GitHub 命令为准。

## MultiChat Orbit 界面

Orbit 的视觉语言来自“本地 Agent 控制轨道”：

- 深色导航轨道承载会话和全局入口，浅色工作区承载当前任务；
- 紫色代表创建与主要操作，青色代表已连接、在线和可运行状态；
- 首页用 Capability Orbit 汇总 Agent、Skill、MCP 与 Plugin 的实时数量；
- 设置中心使用统一的资源卡片、状态徽标、导入向导和详情面板；
- 桌面端与移动端共享同一信息架构，并支持深色主题、键盘焦点和可访问的弹窗交互。

界面不是一层静态外壳。状态、来源、作用域、信任级别、变更 Diff 和运行结果都直接来自后端资源模型，便于在启用能力前完成判断。

## 能力概览

| 能力 | 用途 | 保存位置 | 运行方式 |
|---|---|---|---|
| 对话与工作区 | 多模型对话、上下文与项目资产 | `DATA_DIR` | 本地 API 与浏览器界面 |
| Agent | 组合模型、指令和可调用能力 | `DATA_DIR` | Agent 工具循环 |
| Skill | 提供工作流、知识、脚本和资源 | `.agents/skills/` 或托管目录 | 按需读取，默认不执行脚本 |
| 内置工具 | 时间、计算、网页读取等宿主函数 | 应用代码与状态库 | 由 Runtime 调用 |
| MCP server | 接入 STDIO 或 Streamable HTTP 工具服务 | `DATA_DIR`，可同步到 `.codex/config.toml` | 实时 `tools/list` 与工具调用 |
| Plugin | 分发完整 Codex 能力包 | `.agents/plugins/` | 当前加载包内 Skill 与 MCP |

## 上传与导入

设置中心提供 Skill、MCP 和 Plugin 三条独立导入路径。每条路径都遵循同一个生命周期：

```text
选择文件或目录
      ↓
静态预检与风险提示
      ↓
用户确认
      ↓
原子安装（默认停用）
      ↓
按作用域启用并进入运行时
```

### Skill

支持：

- 单个 `SKILL.md`；
- 包含 `SKILL.md` 的完整目录；
- 包含顶层目录或嵌套目录的 Skill ZIP；
- 可选的 `scripts/`、`references/`、`assets/` 和 `agents/openai.yaml`。

最小目录：

```text
.agents/skills/release-notes/
├── SKILL.md
├── agents/
│   └── openai.yaml       # 可选
├── scripts/              # 可选
├── references/           # 可选
└── assets/               # 可选
```

最小 `SKILL.md`：

```md
---
name: release-notes
description: Generate user-facing release notes from a change summary.
---

# Workflow

1. Identify user-visible changes.
2. Group changes by impact.
3. Never invent changes that are not present in the input.
```

同名 Skill 默认拒绝覆盖。显式确认覆盖时，MultiChat 会先完成预检，再原子替换原目录。新导入或覆盖后的 Skill 默认停用。

Runtime 使用渐进披露：模型先看到 Skill 的名称、描述和 loader；只有任务匹配并调用 loader 后，才读取完整说明与文本 references。发现 Skill 本身不会自动执行其中的脚本。

### MCP

支持：

- 在界面中创建 STDIO server；
- 在界面中创建 Streamable HTTP server；
- 上传 MCP JSON；
- 识别 `mcpServers`、`mcp_servers`、`servers` 或直接 server map；
- 批量导入、独立启停、信任策略、作用域与实时工具发现；
- 将项目范围配置同步到 `.codex/config.toml`。

导入只解析配置，不会在预检或安装阶段启动命令、连接 URL 或调用工具。所有导入项都以“停用 + 未信任”状态落盘。

### Plugin

支持上传 ZIP 或选择完整目录。插件根目录必须包含：

```text
my-plugin/
├── .codex-plugin/
│   └── plugin.json
├── skills/               # 可选
├── .mcp.json             # 可选
└── ...                   # 其他包内资源原样保留
```

MultiChat 会校验 manifest、组件路径、Skill 目录、MCP 配置和凭据位置，再把整包注册到项目 marketplace。导入后默认停用；覆盖升级和卸载会同步处理目录、marketplace、扩展状态与 Agent 引用，失败时回滚。

当前 Runtime 会加载插件中的 **Skills 与 MCP servers**。Agents、Commands、Hooks、Apps 等文件可以随包保留，但上传的 JS/TS 与 hook 不会直接注入 MultiChat 主进程。

## 支持范围

| 能力格式 | 状态 | 说明 |
|---|---|---|
| 标准 Agent Skill 目录 | 支持 | 以 `SKILL.md` 为入口，保留附属资源 |
| Skill ZIP 或完整目录 | 支持导入 | 支持顶层目录和嵌套目录布局 |
| MCP STDIO | 支持 | 本地子进程，不是沙箱 |
| MCP Streamable HTTP | 支持 | 默认限制私网地址，需显式放行 |
| Plugin 完整包 | 支持 | 以 `.codex-plugin/plugin.json` 为入口，保留包内组件与资源 |
| 任意上传的 JS/TS、Hook 或 App | 仅保留 | 未进入经过隔离和授权的宿主模型前，不直接执行 |
| 远程 URL 扩展安装 | 不支持 | 当前只接受本地文件、ZIP、目录或声明式配置 |

“完整包可导入”不等于“所有包内代码都会执行”。这是有意保留的安全与宿主边界。

## Agent 如何组合能力

每个 Agent 可以分别关联：

- `skillRefs`：带来源身份的标准 Skills；
- `toolIds`：MultiChat 内置函数工具；
- `mcpServerIds`：运行前动态发现工具的 MCP servers。

MCP 工具使用 `mcp__<server>__<tool>` 命名空间，避免不同 server 出现同名工具时相互覆盖。旧数据中的 `skillIds` 继续兼容，并会在加载时迁移到新的来源模型。

典型运行过程：

1. Runtime 收集 Agent 已启用的模型、Skill、内置工具和 MCP；
2. Skill 只暴露摘要与 loader，MCP 通过 `tools/list` 获取实时 schema；
3. 模型决定是否加载 Skill 或请求工具；
4. 未信任工具进入逐次审批，已信任工具按策略执行；
5. 工具输出回到模型，直到产生最终回答或达到运行上限；
6. 运行历史、错误和工具调用记录写入本地数据目录。

## TypeScript 在项目中的地位

TypeScript 不是只用于界面类型提示，而是 MultiChat 的主开发语言和架构边界：

- **前端**：Vite + TypeScript，界面模块、API 客户端、状态与主题系统均使用 TS；
- **后端**：Express 路由、模型适配器、扩展导入器、MCP client 与 Agent Runtime 使用 TS；
- **运行**：后端保留成熟的 CommonJS 模块语义，通过 `tsx` 直接运行，避免同时进行语言迁移和模块系统迁移；
- **验证**：前后端分别执行 `tsc --noEmit`，测试也直接运行 TypeScript；
- **兼容入口**：标准 MCP 演示 server 与 Windows 启动 shim 可保留小型 JS/CJS 入口，避免破坏已有配置路径。

这套工程组织由 MultiChat 自身的产品边界和运行需求驱动。它的目标是让请求、资源、扩展、运行时与 UI 共享可检查的类型契约，并以类型检查、自动化测试和明确的安全边界衡量工程质量。

## CLI

CLI 既可通过 GitHub 的 `npx` 命令运行，也可在源码目录中运行。

| 命令 | 作用 |
|---|---|
| `multichat` / `multichat web` | 启动本地网页与 API |
| `multichat doctor` | 检查 Node 版本、前端产物、后端入口、工作区和数据目录 |
| `multichat init [dir]` | 创建一个源码副本并准备本地运行环境 |
| `multichat pull [dir]` | 更新已有源码副本并重新准备构建产物 |
| `multichat deploy` | 本地部署别名；准备并启动本地服务，不发布到远端 |

`web` 与 `deploy` 支持：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--host <host>` | `127.0.0.1` | HTTP 监听地址 |
| `--port <port>` | `3000` | HTTP 端口 |
| `--no-open` | 关闭 | 启动后不自动打开浏览器 |
| `--workspace <path>` | 当前目录 | 被管理项目的根目录 |
| `--data-dir <path>` | `~/.multichat/data` | 对话、Agent 与运行状态目录 |

完整参数以当前版本为准：

```bash
npx --yes github:Leterhong/MultiChat --help
npx --yes github:Leterhong/MultiChat doctor
```

## 从源码运行

```bash
git clone https://github.com/Leterhong/MultiChat.git
cd MultiChat

npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix frontend run build
npm start
```

打开 `http://127.0.0.1:3000`。

后端会直接提供 `frontend/dist`，因此修改界面后需要重新构建前端。开发时可以分别运行前后端的类型检查和测试：

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build

npm --prefix backend run typecheck
npm --prefix backend test

# CLI 参数、doctor 与进程启动测试
npm test
```

Node 22 是最低版本；推荐使用当前维护中的 Node LTS。

## 配置与数据目录

### CLI 默认目录

```text
~/.multichat/
└── data/                  # 对话、Agent、Provider、MCP、运行记录等

<workspace>/
├── .agents/
│   ├── skills/            # 项目 Skills
│   └── plugins/           # marketplace 与插件包
└── .codex/
    └── config.toml        # 可同步的项目 MCP 配置
```

Windows 中的 `~/.multichat/data` 对应当前用户目录下的 `.multichat\data`。

### 环境变量

CLI 会根据参数设置主要环境变量；直接启动后端时也可以手动设置：

| 变量 | 作用 |
|---|---|
| `HOST` | 监听地址，默认 `127.0.0.1` |
| `PORT` | 监听端口，默认 `3000` |
| `DATA_DIR` | 运行数据目录；CLI 默认使用 `~/.multichat/data` |
| `FRONTEND_DIST` | 前端静态产物目录 |
| `MULTICHAT_PROJECT_ROOT` | Skill、Plugin 与 Codex 配置所属的项目根目录 |
| `CORS_ORIGINS` | 逗号分隔的允许来源；默认不额外开放跨域 |
| `NODE_ENV` | 运行模式标识 |

直接在 `backend/` 执行 `npm start` 且未设置 `DATA_DIR` 时，数据默认写入 `backend/data`；通过 CLI 启动时使用用户级目录，避免运行包升级时影响数据。

## 安全模型

MultiChat 会在安装前检查：

- ZIP 路径穿越、绝对路径与符号链接；
- 文件数量、单文件大小、压缩包大小与解压后总量；
- UTF-8 文本、YAML frontmatter、JSON 和 manifest 合法性；
- 组件路径是否留在包内；
- 同名冲突、覆盖意图与来源身份；
- MCP 配置和插件包中的明文凭据位置；
- 更新与卸载过程中的状态一致性。

还需要理解以下运行边界：

- **STDIO MCP 是本机进程，不是沙箱。** 启用前请审阅 command、args 和环境变量；
- 导入和预检不会执行包内脚本、启动 MCP 或连接远程 URL；
- HTTP MCP 默认阻止 localhost、内网和 link-local 目标，只有显式允许后才可连接；
- MCP 子进程只继承必要的基础环境和 server 显式配置，不继承全部进程环境；
- 凭据应通过 `${ENV_VAR}` 或 `${env:ENV_VAR}` 引用，避免明文进入项目文件；
- 停用、更新、删除或退出时会关闭缓存 client 与 STDIO 子进程；
- 将 `HOST` 改为非 loopback 会把服务暴露给局域网或更大网络。当前服务不自带公网身份认证，请只在受控网络和可信代理之后使用。

## HTTP API

界面使用同一套本地 API。主要资源如下：

| 资源 | 代表路径 | 说明 |
|---|---|---|
| 状态 | `GET /api/health`、`GET /api/runtime` | 健康、版本和资源计数 |
| Provider | `/api/providers` | 模型供应商与模型配置 |
| 对话 | `/api/conversations`、`/api/chat` | 对话记录与流式回答 |
| Agent | `/api/agents`、`POST /api/agents/:id/chat` | Agent 管理与工具循环 |
| Skill | `/api/skills`、`/api/skills/:key/diff` | 扫描、编辑、启停和 Diff |
| 内置工具 | `/api/tools` | 工具列表与状态 |
| MCP | `/api/mcp-servers` | 配置、发现、策略与 Codex 同步 |
| Plugin | `/api/plugins` | marketplace、启停、Diff 与卸载 |
| 扩展导入 | `/api/extensions/import/:kind/inspect`、`/install` | Skill、MCP、Plugin 两阶段导入 |
| 运行记录 | `/api/runs` | Agent 与工具运行历史 |

旧的 `POST /api/import` 只用于声明式 Agent JSON 备份，不接受伪装成 Skill 的 MCP、插件代码或远程安装 URL。

## 项目结构

```text
.
├── bin/
│   └── multichat.mjs                 # 一条命令启动与源码管理 CLI
├── .agents/
│   ├── skills/                       # 项目 Skills
│   └── plugins/                      # marketplace + Codex 插件包
├── .codex/
│   └── config.toml                   # 项目 MCP 配置
├── backend/
│   ├── adapters/                     # 模型供应商适配器
│   ├── extensions/
│   │   ├── importer.ts               # 两阶段导入与安全校验
│   │   ├── manager.ts                # 来源、作用域、状态、Diff 与同步
│   │   └── demo-mcp-server.js        # 稳定的 MCP STDIO 兼容入口
│   ├── lib/                          # 存储、上下文和网络安全工具
│   ├── routes/                       # HTTP API
│   ├── runtime/
│   │   └── agent.ts                  # Skill loader 与工具循环
│   ├── mcp.ts                        # STDIO / Streamable HTTP client
│   ├── server.ts                     # 服务入口
│   └── tests/                        # Node TypeScript tests
├── frontend/
│   ├── src/
│   │   ├── core/                     # API、状态、主题
│   │   ├── modules/                  # 会话、设置、扩展与 Shell
│   │   └── styles.css                # Orbit 设计系统
│   └── dist/                         # 构建后的网页
├── package.json                      # CLI 包入口
└── README.md
```

## 路线图

- 继续收紧后端与前端 TypeScript 类型，逐步减少宽泛类型；
- 发布正式 npm 包，并为 CLI 增加可验证的版本与升级通道；
- 增强扩展权限清单、来源签名和安装审计；
- 在明确的隔离与授权模型下扩展 Plugin 宿主能力；
- 增加端到端浏览器测试、导入夹具和跨平台 CLI 测试；
- 持续完善移动端、键盘操作、屏幕阅读器语义和高对比度主题。

## 参与贡献

欢迎提交 Issue 或 Pull Request。开始开发前请：

1. 说明要解决的用户问题和兼容边界；
2. 保持 Skill、MCP、Plugin 与内置工具的模型分离；
3. 为导入、安全策略和数据迁移补充测试；
4. 运行前后端类型检查、后端测试和前端构建；
5. 不在示例、测试夹具或提交记录中加入真实密钥。

如果变更会执行新的本机命令、扩大网络访问、修改扩展格式或改变默认信任策略，请在 Pull Request 中单独说明风险和迁移方式。

## 开源协议

MultiChat 采用 [MIT License](./LICENSE) 开源。你可以在保留版权与许可声明的前提下使用、复制、修改、合并、发布和分发本项目。
