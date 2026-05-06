/**
 * ClawTip 支付服务 - 工具函数
 */

import * as crypto from 'crypto';
import * as uuid from 'uuid';

/**
 * 生成业务订单号
 * 格式：CL + 毫秒时间戳 + 6位随机 hex
 * 示例：CL1714326400000a3f2b1
 */
export function generateOrderNo(): string {
  const ts = Date.now();
  const rand = uuid.v4().replace(/-/g, '').slice(0, 6);
  return `CL${ts}${rand}`;
}

/**
 * 生成内部订单 ID (UUID v4)
 */
export function generateOrderId(): string {
  return uuid.v4();
}

/**
 * 计算 Indicator（技能标识哈希）
 * 官方算法：对技能 slug 做 MD5
 *
 * @param slug 技能 slug 名称，如 'my-awesome-skill'
 * @returns 32 位小写 hex 字符串
 */
export function computeIndicator(slug: string): string {
  return crypto.createHash('md5').update(slug, 'utf-8').digest('hex');
}

/**
 * 构建待加密的 JSON 字符串
 * 官方格式：{ orderNo, amount(字符串), payTo }
 */
export function buildEncryptPayload(orderNo: string, amount: number, payTo: string): string {
  return JSON.stringify({
    orderNo,
    amount: String(amount), // ⚠️ 官方要求 amount 为字符串
    payTo,
  });
}
