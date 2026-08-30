# MultiChat

[![CI](https://github.com/Leterhong/MultiChat/actions/workflows/ci.yml/badge.svg)](https://github.com/Leterhong/MultiChat/actions/workflows/ci.yml)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-287254.svg)](./LICENSE)

> 把模型、运行配置、工具与项目上下文，放进同一个本地工作台。

MultiChat 是一个开源、本地优先的多模型工作台。你可以在浏览器中连接不同模型，保存可复用的运行配置，并按任务组合 Skill、内置工具、MCP 与 Plugin。

每类能力保留自己的格式、来源和安全边界，再由运行配置按需组合；对话、项目文件、扩展状态与运行记录都集中在一个工作区中。

## 当前阶段

> [!IMPORTANT]
> MultiChat 正在持续迭代，数据结构、扩展接口与 CLI 仍可能变化。当前版本适合本机和可信项目环境，不建议直接暴露到公网。

对话、Agent、Skill、MCP、Plugin 导入、本地运行、用量分析、断点续跑与执行审计链路已经可用。更多隔离能力、协作能力和正式 npm 发行仍在继续完善。

## 快速开始

安装 [Node.js](https://nodejs.org/) 22.13 或更高版本，然后运行：

```bash
npx --yes github:Leterhong/MultiChat web
```

命令会从 GitHub 获取当前版本，在本机启动 Web UI，并尝试自动打开 `http://127.0.0.1:3000`。当前目录是默认工作区，运行数据保存在 `~/.multichat/data`；按 `Ctrl+C` 即可停止服务。

常用参数：

```bash
# 更换端口并禁止自动打开浏览器
npx --yes github:Leterhong/MultiChat web --port 3100 --no-open

# 指定工作区与数据目录
npx --yes github:Leterhong/MultiChat web \
  --workspace ./my-agent-project \
  --data-dir ./.multichat-data
```

CLI 还提供 `doctor`、`init`、`pull` 与 `deploy`：

```bash
npx --yes github:Leterhong/MultiChat --help
npx --yes github:Leterhong/MultiChat doctor
```

`doctor` 会实际探测 `node:sqlite` 与 `DatabaseSync`、生产构建、目录权限和监听端口。若 SQLite 在受限运行环境初始化失败，服务会明确告警并自动降级到 JSON 存储；也可以主动设置 `MULTICHAT_STORE=json`。

> [!NOTE]
> 当前 Node.js（含 22.x/24.x）中 `node:sqlite` 仍是实验特性，Node 官方尚未宣布稳定。MultiChat 已把 SQLite 作为默认存储，但请把 `multichat.sqlite3` 视为「可随时由 MultiChat 迁移的内部格式」，不要直接读写或长期依赖其表结构；需要长期备份时使用项目快照功能，或设置 `MULTICHAT_STORE=json` 使用透明可读的 JSON 存储。

## 核心体验

- **统一管理**：在一个界面中组织模型、对话、工作区和项目文件；
- **零配置体验**：通过“本地体验（无需密钥）”走通模型选择、流式对话、运行记录与 Token 用量；
- **并行模型实验**：让 2–4 个模型在相同参数、项目文件和记忆上下文下并行回答；实验保存在当前设备，可随时恢复，并把选定结果直接采用到正式对话；
- **运行配置**：自由搭配模型、系统指令、Skill、内置工具与 MCP server，并只向本轮注入实际选中的能力；
- **上下文检查**：开始运行前核对模型连接、项目上下文与能力组合，估算文件上下文 Token，运行后直接查看最近一次步骤、工具调用与 Token；
- **快速命令**：`Ctrl+K` 搜索操作，`Ctrl+I` 检查上下文，`Ctrl+M` 发起模型实验；
- **安全扩展**：导入 Skill、MCP 配置和 Plugin，启用前检查冲突、风险与变更；
- **每日用量中心**：按 7 天、30 天或全部时间查看输入/输出 Token、趋势、模型占比、活跃热力图与提供方健康；
- **执行与复盘**：保留模型步骤、工具调用、审批、错误与 Token 构成，并复查每次请求实际携带的上下文；
- **可恢复运行**：高风险工具审批与迭代上限都会形成持久化检查点，关闭响应或重启服务后仍可继续；
- **项目知识与记忆**：搜索项目文件并保留文件、行号引用，只将用户确认的长期事实和偏好写入项目记忆；
- **能力护照**：集中展示 Skill、MCP、Plugin 与内置工具的来源、版本、权限、信任状态、风险和结构问题；
- **项目快照**：保存项目设置、文件、记忆和关联 Agent，恢复前自动备份，便于安全试验和回滚；
- **本地安全账本**：Provider 密钥加密落盘且不会返回浏览器，用量记录只保存统计元数据，不保存提示词正文；
- **适配不同设备**：工作台面向桌面与移动屏幕响应式设计，并支持深色主题、键盘操作和无障碍焦点管理。

## 工程结构

MultiChat 把宿主运行时、Web 客户端和扩展边界分开维护：

```text
backend/            TypeScript API、运行时、SQLite 存储与扩展管理
backend/dist/       预编译的 Node.js 生产运行文件
frontend/src/core/  客户端状态、API、主题与基础工具
frontend/src/app/   React / TSX 应用外壳与语义化导航
frontend/src/components/ React 消息流、输入区与安全 Markdown 组件
frontend/src/design/ CSS 设计 Token 与主题变量
frontend/src/modules/  工作台、对话、设置、导入与观察界面
bin/                multichat 命令入口
.agents/            项目 Skills 与插件资源
```

一次请求会被记录为 Run；Run 包含一个或多个 Turn，Turn 再由模型请求、工具调用和审批 Step 组成。运行日志和检查点是复查、继续、分支和诊断的统一事实来源。业务数据默认保存在单文件 SQLite 数据库中，首次启动会自动读取已有 JSON 数据；设置 `MULTICHAT_STORE=json` 可继续使用旧存储方式。

## 扩展方式

| 类型 | 用途 | 入口 |
|---|---|---|
| Skill | 封装工作流、知识、脚本与资源 | `SKILL.md` |
| MCP | 连接独立的标准工具服务 | STDIO / Streamable HTTP |
| Plugin | 分发一组完整扩展资源 | `.codex-plugin/plugin.json` |

Skill 支持单文件、完整目录和 ZIP，并会原样保留但不执行 `x-*` 厂商扩展元数据；MCP 支持界面配置与 JSON；Plugin 支持符合当前兼容范围的 ZIP 和完整目录。三类扩展分别管理来源、作用域与启用状态，导入时不会自动执行。

导入分为“预检”和“安装”两个阶段。MultiChat 会检查路径穿越、压缩包限制、格式错误、同名冲突、组件越界与高风险凭据位置，并对 Plugin MCP 中的字面量凭据执行更严格限制，再通过暂存、原子替换与回滚机制完成安装。新导入的扩展默认停用，MCP 同时默认为未受信任。

Skill 中的脚本只会随包保存并列出路径，不会自动执行。当前 Plugin Runtime 会加载包内的 **Skills 与 MCP servers**；其他 JS/TS、Hooks、Commands、Apps 等资源可以随包保存，但不会未经隔离和授权直接注入 MultiChat 主进程。

## Docker / Linux 服务器

MultiChat 是纯 Node.js 应用，Linux（x64/arm64）开箱即跑。两种常驻方式：

**Docker（推荐，数据与工作区分离挂载）：**

```bash
# 使用官方镜像（推送到 main / 打 tag 时由 CI 自动构建发布）
docker run -d --name multichat -p 3000:3000   -v multichat-data:/data   -v "$PWD:/workspace"   ghcr.io/leterhong/multichat:latest

# 本地构建
docker build -t multichat .
docker run -d -p 3000:3000 -v multichat-data:/data -v "$PWD:/workspace" multichat
```

容器内 `/data` 保存运行数据（SQLite、加密密钥账本），`/workspace` 是 Agent 工作区（项目文件、.agents 扩展）。镜像以非 root 用户运行，默认监听 `0.0.0.0:3000`。

**systemd 常驻（不用容器时）：**

```ini
# /etc/systemd/system/multichat.service
[Unit]
Description=MultiChat local agent workspace
After=network-online.target

[Service]
Type=simple
User=%i
WorkingDirectory=/home/%i/multichat-workspace
ExecStart=/usr/bin/env node /home/%i/multichat/bin/multichat.mjs web --host 127.0.0.1 --port 3000
Restart=on-failure

[Install]
WantedBy=default.target
```

> [!IMPORTANT]
> 把服务暴露到局域网或公网前，务必设置 `MULTICHAT_API_TOKEN`（保护 `/api/*` 与 `/v1/*`，包括 OpenAI 兼容透传端点）或 `MULTICHAT_BASIC_AUTH`；`/v1/chat/completions` 会使用你配置的模型密钥，无鉴权暴露等于把密钥借给别人。

## 从源码运行

```bash
git clone https://github.com/Leterhong/MultiChat.git
cd MultiChat

npm install
npm --prefix backend install
npm --prefix frontend install
npm run build
npm start
```

前端使用 React + TSX 数据驱动消息流、输入区、模型实验、Plugin 与 MCP 管理界面，长对话由虚拟列表渲染；Markdown 经过白名单消毒后再显示。静态 HTML 只保留浏览器挂载节点，Zustand 是业务数据与界面编排状态的统一来源，CSS 设计 Token 统一主题。后端 TypeScript 会先编译为 `backend/dist`，生产环境直接由 Node.js 运行，不依赖启动时转译。提交变更前可以运行：

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run lint:css
npm --prefix frontend test
npm --prefix backend run typecheck
npm --prefix backend test
npm run build
npm test
```

## 安全边界

- 本地优先不等于所有推理都在本地完成；云端模型和远程 MCP 仍会收到相应请求；
- STDIO MCP 以当前用户权限运行本机进程，不是沙箱；
- HTTP MCP 默认限制 localhost、内网和 link-local 地址，只有显式允许后才会连接；
- 凭据应通过环境变量引用，不要写进扩展包、配置、示例或 Git 提交；
- 服务默认只监听 `127.0.0.1`，对外提供访问时需要可信网络或额外认证；
- 可通过 `MULTICHAT_API_TOKEN`（兼容 `MC_API_TOKEN`）为 `/api/*` 与 `/v1/*` 启用 Bearer Token，或通过 `MULTICHAT_BASIC_AUTH=user:password` 启用 Basic Auth；
- STDIO MCP 子进程默认只继承启动所需的最小系统环境，额外变量必须在 MCP 配置中显式声明。

## 参与项目

欢迎通过 [Issues](https://github.com/Leterhong/MultiChat/issues) 提交问题与建议，也欢迎发起 [Pull Requests](https://github.com/Leterhong/MultiChat/pulls)。

涉及本机命令、网络访问、扩展格式或默认信任策略的变更，请在提交说明中单独列出安全影响。

## 开源协议

MultiChat 使用 [MIT License](./LICENSE) 开源。
