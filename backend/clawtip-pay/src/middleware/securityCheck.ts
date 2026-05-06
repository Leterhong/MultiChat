/**
 * ClawTip 支付服务 - 安全检查中间件
 *
 * 职责：确保 API 响应中不泄露敏感信息
 */

import { Response } from 'express';

/**
 * 安全红线检查项
 * 检查 JSON 序列化后的响应中是否包含敏感字段
 */
const SENSITIVE_FIELDS = [
  'sm4Key',
  'CLAWTIP_SM4_KEY',
  'sm4_key',
  'encryptedData',
  '_raw',
  'payCredential', // 仅在内部使用，API 不应暴露
];

/**
 * 拦截 res.json，检查响应中是否包含敏感字段
 * 仅在开发模式下启用，生产模式跳过（性能考虑）
 */
export function securityAuditMiddleware(
  _req: any,
  _res: Response,
  next: Function
): void {
  if (process.env.NODE_ENV !== 'development') {
    next();
    return;
  }

  const originalJson = _res.json.bind(_res);

  _res.json = (body: any) => {
    const serialized = JSON.stringify(body);
    const leaked: string[] = [];

    for (const field of SENSITIVE_FIELDS) {
      if (serialized.includes(field)) {
        leaked.push(field);
      }
    }

    if (leaked.length > 0) {
      console.error(
        `[SECURITY] ⚠️ 检测到敏感字段泄露！泄露字段: ${leaked.join(', ')}`
      );
    }

    return originalJson(body);
  };

  next();
}
