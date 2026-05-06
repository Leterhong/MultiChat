<div align="center">

# MultiChat

**一个开箱即用的多模型聚合聊天平台**

统一接入 GPT / Qwen / DeepSeek / Ollama 等主流模型，内置竞技场对战、模型评测、插件系统和技能市场

[![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?logo=docker&logoColor=white)](https://hub.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[快速开始](#-快速开始) · [功能特性](#-功能特性) · [支持的模型](#-支持的模型) · [技术架构](#-技术架构)

</div>

---

## ✨ 功能特性

### 💬 智能对话
- **多模型切换** — 同一对话中随时切换模型，对比不同模型的表现
- **流式输出** — 逐 token 实时展示，打字机般流畅体验
- **Markdown 渲染** — 代码高亮、表格、数学公式，开箱即用
- **多模态输入** — 粘贴或拖拽图片发送，支持视觉理解
- **Token 费用估算** — 每条回复实时显示 token 消耗与费用
- **对话导出** — 一键导出为 Markdown 或 PDF

### ⚔️ 竞技场
- 多模型同台竞技，同一个 prompt 同时发送给多个模型
- 实时流式对比输出，逐轮投票选出最佳模型

### 📊 模型评测
- 基于 MT-Bench 标准的自动化评测
- 多维度评分 + 评测报告生成（JSON / Markdown）
- 支持生成分享图

### 🧩 插件系统
- 浏览、安装、管理社区插件
- 支持 Prompt 注入和 API 调用两种类型
- URL 导入，一键安装远程插件

### ⚡ 技能市场
- 预置技能库，一键增强模型专业能力
- 技能编辑器 + UGC 社区发布

### 🎨 更多
- 暗黑 / 亮色主题切换
- 提示词中心 & 模板库
- 注册登录 / JWT 认证
- 余额管理与充值

---

## 🤖 支持的模型

内置适配器，统一 OpenAI 兼容接口，只需配置 Base URL + API Key 即可接入：

| 供应商 | 模型示例 | 适配器 |
|--------|----------|--------|
| OpenAI | GPT-4o / GPT-4 / GPT-3.5 | `openai` |
| 通义千问 | Qwen 系列 | `qwen` |
| Moonshot | Kimi 系列 | `moonshot` |
| 智谱 | GLM 系列 | `zhipu` |
| 文心一言 | ERNIE 系列 | `wenxin` |
| Ollama | Llama / Qwen 本地部署 | `ollama` |
| LM Studio | 本地模型服务 | `lmstudio` |
| 自定义 | 任何 OpenAI 兼容接口 | `openai` |

> 💡 接入新供应商只需编写一个适配器文件，实现 `createAdapter()` 接口即可。

---

## 🚀 快速开始

### Docker 一键部署（推荐）

```bash
git clone https://github.com/<your-username>/multichat.git && cd multichat

chmod +x deploy.sh && ./deploy.sh
```

部署完成后访问 `http://localhost:3000` 即可使用。

也可以手动操作：

```bash
docker-compose up -d
```

### 本地开发

```bash
cd backend
npm install
npm run dev        # 开发模式，自动重启
```

前端无需构建，`frontend/dist/index.html` 直接在浏览器打开或通过后端静态托管访问。

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│                  前端 SPA                    │
│         单文件 index.html · 零构建            │
│   CSS 变量主题 · IndexedDB 本地存储           │
└──────────────────┬──────────────────────────┘
                   │ HTTP / SSE
┌──────────────────▼──────────────────────────┐
│              Node.js 后端                     │
│          Express + JWT 认证                   │
│   适配器工厂 → OpenAI / Ollama / Qwen ...    │
└─────────────────────────────────────────────┘
```

| 层 | 技术选型 |
|----|----------|
| 前端 | 原生 HTML + CSS + JS，单文件 SPA，CSS 变量主题，Dexie.js (IndexedDB) |
| 后端 | Node.js 20+，Express 4，JWT 认证 |
| 依赖 | 极简运行时依赖：express / cors / bcryptjs / jsonwebtoken |
| 部署 | Docker 多阶段构建，docker-compose 编排 |

---

## 📁 项目结构

```
├── frontend/dist/index.html    # 前端单页应用（CSS/JS 全部内联）
├── backend/
│   ├── server.js               # 后端入口（API + 静态文件托管）
│   ├── adapters/               # AI 供应商适配器（工厂模式）
│   │   ├── openai.js           #   OpenAI / 兼容接口
│   │   ├── ollama.js           #   Ollama 本地模型
│   │   ├── qwen.js / moonshot.js / zhipu.js / wenxin.js
│   │   └── lmstudio.js
│   └── clawtip-direct.js       # 支付模块（可选）
├── Dockerfile                  # 多阶段构建
├── docker-compose.yml          # 编排配置
└── deploy.sh                   # 一键部署脚本
```

---

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `DATA_DIR` | `backend/data` | 数据存储目录 |
| `JWT_SECRET` | `multichat_jwt_secret_2024_change_me` | JWT 密钥，**生产环境务必修改** |

可通过 `docker-compose.yml` 的 `environment` 字段或 `.env` 文件配置。

---

## 🛠️ 常用命令

```bash
docker-compose up -d          # 启动
docker-compose down           # 停止
docker-compose restart        # 重启
docker-compose logs -f        # 实时日志
PORT=8080 docker-compose up   # 自定义端口
```

---

## 📄 License

[MIT](LICENSE)
