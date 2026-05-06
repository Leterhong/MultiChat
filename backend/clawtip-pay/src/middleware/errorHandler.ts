/**
 * ClawTip 支付服务 - 全局错误处理中间件
 *
 * 职责：
 * 1. 捕获所有未处理的异常
 * 2. 统一响应格式
 * 3. ⚠️ 绝不向前端暴露堆栈信息、密钥等敏感数据
 */

import { Request, Response, NextFunction } from 'express';

interface ErrorWithCode extends Error {
  code?: string;
  statusCode?: number;
}

export function errorHandler(
  err: ErrorWithCode,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 构造安全的错误响应
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // 安全红线：确保响应中不包含敏感信息
  let message = err.message || '服务器内部错误';

  // 过滤可能的敏感信息泄露
  const sensitivePatterns = [
    /sm4_key/i,
    /CLAWTIP_SM4_KEY/i,
    /密钥/i,
    /secret/i,
    /password/i,
  ];
  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      message = '服务器内部错误';
      break;
    }
  }

  console.error(`[Error] ${code}: ${err.message}`);

  // 开发环境打印堆栈（生产环境关闭）
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    code,
    message,
    // 生产环境不暴露任何额外信息
    ...(process.env.NODE_ENV === 'development' && {
      details: err.stack?.split('\n').slice(0, 3),
    }),
  });
}

/**
 * 404 处理
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: '接口不存在',
  });
}
