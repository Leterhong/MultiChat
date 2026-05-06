/**
 * ClawTip 支付服务 - 主入口
 *
 * 京东 ClawTip 支付对接后端
 * 技术栈：Node.js + TypeScript + Express
 */

import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// 加载环境变量（必须在所有其他 import 之前）
dotenv.config();

import ordersRouter from './routes/orders';
import clawtipRouter from './routes/clawtip';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityAuditMiddleware } from './middleware/securityCheck';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── 全局中间件 ─────────────────────────────────────────────

// JSON 解析
app.use(express.json({ limit: '1mb' }));

// CORS 跨域配置
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());
app.use(
  cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 安全审计（仅开发环境）
app.use(securityAuditMiddleware);

// 请求日志（简易版）
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api/')) {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} → ${_res.statusCode} (${duration}ms)`
      );
    }
  });
  next();
});

// ─── 路由挂载 ───────────────────────────────────────────────

app.use('/api/orders', ordersRouter);
app.use('/api/clawtip', clawtipRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'clawtip-pay-server',
    version: '1.0.0',
  });
});

// ─── 错误处理 ───────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── 启动服务 ───────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('  🚀 ClawTip 支付服务已启动');
  console.log(`  📍 地址: http://localhost:${PORT}`);
  console.log(`  🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  📋 API:`);
  console.log(`     POST   /api/orders              创建订单`);
  console.log(`     POST   /api/orders/:orderNo/pay  发起支付`);
  console.log(`     GET    /api/orders/:orderNo/status  查询状态`);
  console.log(`     POST   /api/clawtip/callback     异步回调`);
  console.log(`     GET    /api/health               健康检查`);
  console.log('='.repeat(50));
});

export default app;
