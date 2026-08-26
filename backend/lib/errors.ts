// ── 统一错误码 + 请求ID 中间件（A3） ───────────────────────────────────
// 设计目标：在不破坏既有契约（前端读 res.data.error 字符串）的前提下，
// 为每次请求附加 requestId，并为错误响应附加 code 字段，便于排障与日志关联。
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { redactSecrets } from './redact';

// 业务错误码 → HTTP 状态码 映射
export const ERROR_CODES: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  IMPORT_FAILED: 502,
  SSRF_BLOCKED: 403,
  PLUGIN_NOT_FOUND: 404,
  PROVIDER_NOT_FOUND: 404,
  AGENT_NOT_FOUND: 404,
  SKILL_NOT_FOUND: 404,
  PERMISSION_DENIED: 403,
  APPROVAL_NOT_PENDING: 409,
  CONFLICT: 409,
  INVALID_PACKAGE: 400,
  MCP_CONNECTION_FAILED: 502,
  UPSTREAM: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = 'AppError';
    this.code = ERROR_CODES[code] !== undefined ? code : 'INTERNAL';
    this.statusCode = statusCode || ERROR_CODES[this.code] || 500;
  }
}

// 请求ID 中间件：每个请求分配一个 id（允许上游透传 X-Request-Id）
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : '';
  const id = /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
    ? supplied
    : crypto.randomBytes(8).toString('hex');
  (req as any).requestId = id;
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// 结构化失败响应：保持 error 为字符串以兼容旧前端，额外带 code / requestId
export function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({
    error: message,
    code,
    requestId: res.locals.requestId || null,
  });
}

// 全局错误处理：兜底未捕获异常，统一输出 { error, code, requestId }
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(err);
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL';
  const message = redactSecrets(err.message || 'Internal Server Error');
  if (status >= 500) {
    console.error('[error]', code, redactSecrets(message), 'reqId=', (req as any).requestId, err.stack ? '\n' + redactSecrets(err.stack) : '');
  }
  res.status(status).json({
    error: message,
    code,
    requestId: (req as any).requestId || res.locals.requestId || null,
  });
}
