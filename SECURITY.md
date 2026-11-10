# 安全政策

## 支持版本

| 版本 | 支持状态 |
| --- | --- |
| 1.9.x | ✅ 当前维护 |
| 1.8.x 及更早 | ❌ 含未修复的本地命令执行链，请立即升级 |

## 报告漏洞

**不要通过公开 Issue 报告安全问题。**

- 私密渠道：GitHub Security Advisories（仓库页 → Security → Report a vulnerability）
- 响应目标：48 小时内确认，7 天内给出评估与修复计划
- 修复发布后会在 Release 说明中致谢报告者（除非你希望匿名）

## 默认安全模型（1.9.0 起）

MultiChat 是本地优先工具，默认只监听 `127.0.0.1`。在此前提下：

- **自动访问令牌**：未显式配置凭据时，服务在数据目录生成随机令牌（`.runtime-token`，0600）。同源页面通过 `GET /api/session` 领取，令牌只存于当前标签页 `sessionStorage`；`/api/health` 为健康检查保持开放。
- **Host 白名单**：回环监听下只接受 `127.0.0.1` / `localhost` / `::1` 及显式配置的 `MULTICHAT_ALLOWED_HOSTS`，用于阻断 DNS rebinding。
- **跨站请求拦截**：拒绝 `Sec-Fetch-Site: cross-site` 与非本机 `Origin` 的 API 请求。
- **MCP 启动约束**：STDIO 可执行文件白名单、禁止内联代码参数与危险环境变量（如 `NODE_OPTIONS` / `PATH`）。
- **显式关闭**：`MULTICHAT_NO_AUTH=1` 会完全关闭鉴权，仅应在可信本机环境使用；非回环 `--host` 会放宽 Host 校验并打印警告，此时必须自行配置反向代理与凭据。

## 影响范围说明

以下场景的风险请随报告一并说明：

- 服务被显式暴露到局域网/公网（`--host` / 反向代理）且未配置凭据
- 自动令牌引导端点 `/api/session` 的同源判定被绕过
- 扩展导入（Skill ZIP / MCP 配置 / Plugin）的解析与落盘路径
- 本机其他进程读取同一用户的数据目录（属 local-first 设计取舍，报告时请说明前提）

## 审计记录

2026-11-10 完成一次全维度渗透审计。审计实证的「默认无鉴权 + MCP 任意命令 + Host 不校验」链已修复，并补充了集成回归测试（`backend/tests/access-guard.test.ts`、`backend/tests/mcp-guard.test.ts`）。

修复随 **v1.9.0** 发布。同批加固还包括：响应头与构建期 CSP meta、legacy overlay HTML 净化、`?api=` 仅允许回环无凭据 origin、MCP STDIO 启动白名单、lockfile 官方源与 integrity 校验、发布包剔除 sourcemap、工作流最小权限与 npm provenance。已安装 1.8.x 及更早版本的用户应升级；如确需保持旧版，务必不要通过 `--host` 暴露服务、不要配置 `MULTICHAT_NO_AUTH=1`、不要导入来源不明的 MCP 配置。
