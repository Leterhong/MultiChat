# 安全政策

## 支持版本

| 版本 | 支持状态 |
| --- | --- |
| 1.6.x | ✅ 当前维护 |
| < 1.6 | ❌ 请升级 |

## 报告漏洞

**不要通过公开 Issue 报告安全问题。**

- 私密渠道：GitHub Security Advisories（仓库页 → Security → Report a vulnerability）
- 响应目标：48 小时内确认，7 天内给出评估与修复计划
- 修复发布后会在 Release 说明中致谢报告者（除非你希望匿名）

## 影响范围说明

MultiChat 默认只监听 `127.0.0.1`，定位为本地优先工具。以下场景的风险请随报告一并说明：

- 服务被显式暴露到局域网/公网（`--host` / 反向代理）
- 通过 `MULTICHAT_API_TOKEN` 或 `MULTICHAT_BASIC_AUTH` 启用鉴权时的绕过可能
- 扩展导入（Skill ZIP / MCP 配置 / Plugin）的解析与落盘路径
