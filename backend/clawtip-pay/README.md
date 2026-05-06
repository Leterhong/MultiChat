# ClawTip 支付后端服务

京东 ClawTip 支付对接后端服务，Node.js + TypeScript + Express。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 ClawTip 配置（登录 clawtip.jd.com 后台获取）

# 3. 开发模式启动（热重载）
npm run dev

# 4. 生产编译
npm run build
npm start
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/orders` | 创建订单 |
| POST | `/api/orders/:orderNo/pay` | 发起 ClawTip 支付 |
| GET | `/api/orders/:orderNo/status` | 查询订单状态 |
| POST | `/api/clawtip/callback` | ClawTip 异步回调 |
| GET | `/api/health` | 健康检查 |

### 创建订单

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user001", "productType": "skill_premium", "amount": 100}'
```

响应：
```json
{
  "code": "SUCCESS",
  "data": {
    "orderId": "uuid",
    "orderNo": "CL1714326400000a3f2b1",
    "indicator": "md5hash...",
    "status": "pending",
    "amount": 100
  }
}
```

### 发起支付

```bash
curl -X POST http://localhost:3000/api/orders/CL1714326400000a3f2b1/pay
```

### 查询状态

```bash
curl http://localhost:3000/api/orders/CL1714326400000a3f2b1/status
```

## 项目结构

```
src/
├── index.ts                    # 主入口
├── types/
│   └── index.ts               # 类型定义
├── store/
│   └── OrderStore.ts          # 内存订单存储
├── services/
│   └── ClawTipService.ts      # ClawTip 核心服务（SM4加密/CLI调用/响应解析）
├── routes/
│   ├── orders.ts              # 订单路由
│   └── clawtip.ts             # ClawTip 回调路由
├── utils/
│   ├── sm4.ts                 # SM4-CBC 加密
│   └── helpers.ts             # 工具函数（订单号/indicator/加密payload）
└── middleware/
    ├── errorHandler.ts        # 全局错误处理
    └── securityCheck.ts       # 安全审计中间件
```

## 安全设计

- SM4 密钥只在后端 `.env` 中配置，绝不暴露给前端
- SM4 密钥不通过 CLI 命令行参数传递，仅通过环境变量注入
- 所有 API 响应经过安全审计，不包含密钥等敏感信息
- 错误处理中间件过滤堆栈信息，生产环境不暴露内部细节
- ClawTip 回调支持验签和防重放

## 技术参考

- [ClawTip 官方网站](https://clawtip.jd.com/)
- [ClawTip 付费技能开发指南](https://llmbase.ai/openclaw/clawtip-paid-skill-guide/)
- 基于 X402 协议的 A2A 支付基础设施
