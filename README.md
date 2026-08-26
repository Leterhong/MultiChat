# MultiChat

[![CI](https://github.com/Leterhong/MultiChat/actions/workflows/ci.yml/badge.svg)](https://github.com/Leterhong/MultiChat/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-5b52df.svg)](./LICENSE)

> 把模型、Agent 与工具，放进同一个本地工作区。

MultiChat 是一个开源、本地优先的多模型 Agent 工作台。你可以在浏览器中连接不同模型、创建 Agent，并按任务组合 Skill、内置工具、MCP 与 Plugin。

每类能力保留自己的格式、来源和安全边界，再由 Agent 在运行时按需组合；对话、项目文件、扩展状态与运行记录都集中在一个工作区中。

## 当前阶段

> [!IMPORTANT]
> MultiChat 正在持续迭代，数据结构、扩展接口与 CLI 仍可能变化。当前版本适合本机和可信项目环境，不建议直接暴露到公网。

对话、Agent、Skill、MCP、Plugin 导入、本地运行、用量分析与执行审计链路已经可用。更多隔离能力、协作能力和正式 npm 发行仍在继续完善。

## 快速开始

安装 [Node.js](https://nodejs.org/) 22 或更高版本，然后运行：

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

## 核心体验

- **统一管理**：在一个界面中组织模型、对话、工作区和项目文件；
- **组合 Agent**：自由搭配模型、系统指令、Skill、内置工具与 MCP server；
- **安全扩展**：导入 Skill、MCP 配置和 Plugin，启用前检查冲突、风险与变更；
- **每日用量中心**：按 7 天、30 天或全部时间查看输入/输出 Token、趋势、模型占比、活跃热力图与提供方健康；
- **运行黑匣子**：保留模型步骤、工具调用、审批、错误与 Token 构成，通过 Context Lens 复查每次请求实际携带的上下文；
- **项目知识与记忆**：搜索项目文件并保留文件、行号引用，只将用户确认的长期事实和偏好写入项目记忆；
- **能力护照**：集中展示 Skill、MCP、Plugin 与内置工具的来源、版本、权限、信任状态、风险和结构问题；
- **项目快照**：保存项目设置、文件、记忆和关联 Agent，恢复前自动备份，便于安全试验和回滚；
- **本地安全账本**：Provider 密钥加密落盘且不会返回浏览器，用量记录只保存统计元数据，不保存提示词正文；
- **适配不同设备**：Orbit 是面向桌面与移动屏幕的响应式 Web UI，并支持深色主题和键盘操作。

## 扩展方式

| 类型 | 用途 | 入口 |
|---|---|---|
| Skill | 封装工作流、知识、脚本与资源 | `SKILL.md` |
| MCP | 连接独立的标准工具服务 | STDIO / Streamable HTTP |
| Plugin | 分发一组完整扩展资源 | `.codex-plugin/plugin.json` |

Skill 支持单文件、完整目录和 ZIP；MCP 支持界面配置与 JSON；Plugin 支持符合当前兼容范围的 ZIP 和完整目录。三类扩展分别管理来源、作用域与启用状态，导入时不会自动执行。

导入分为“预检”和“安装”两个阶段。MultiChat 会检查路径穿越、压缩包限制、格式错误、同名冲突、组件越界与高风险凭据位置，并对 Plugin MCP 中的字面量凭据执行更严格限制，再通过暂存、原子替换与回滚机制完成安装。新导入的扩展默认停用，MCP 同时默认为未受信任。

Skill 中的脚本只会随包保存并列出路径，不会自动执行。当前 Plugin Runtime 会加载包内的 **Skills 与 MCP servers**；其他 JS/TS、Hooks、Commands、Apps 等资源可以随包保存，但不会未经隔离和授权直接注入 MultiChat 主进程。

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

前端、API、扩展管理和 Agent Runtime 均以 TypeScript 为主要开发语言。提交变更前可以运行：

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix backend run typecheck
npm --prefix backend test
npm test
```

## 安全边界

- 本地优先不等于所有推理都在本地完成；云端模型和远程 MCP 仍会收到相应请求；
- STDIO MCP 以当前用户权限运行本机进程，不是沙箱；
- HTTP MCP 默认限制 localhost、内网和 link-local 地址，只有显式允许后才会连接；
- 凭据应通过环境变量引用，不要写进扩展包、配置、示例或 Git 提交；
- 服务默认只监听 `127.0.0.1`，对外提供访问时需要可信网络或额外认证。

## 参与项目

欢迎通过 [Issues](https://github.com/Leterhong/MultiChat/issues) 提交问题与建议，也欢迎发起 [Pull Requests](https://github.com/Leterhong/MultiChat/pulls)。

涉及本机命令、网络访问、扩展格式或默认信任策略的变更，请在提交说明中单独列出安全影响。

## 开源协议

MultiChat 使用 [MIT License](./LICENSE) 开源。
