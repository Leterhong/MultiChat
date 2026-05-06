/**
 * ClawTip 支付服务 - TypeScript 类型定义
 */

/** 订单状态 */
export enum OrderStatus {
  /** 待支付 */
  Pending = 'pending',
  /** 支付中（用户已进入授权流程） */
  Paying = 'paying',
  /** 支付成功 */
  Success = 'success',
  /** 支付失败 */
  Failed = 'failed',
}

/** 订单数据模型 */
export interface Order {
  /** 内部唯一 ID (UUID) */
  id: string;
  /** 业务订单号（CL + 时间戳 + 随机数） */
  orderNo: string;
  /** 前端传来的用户标识 */
  userId: string;
  /** 购买的产品类型，如 'skill_premium', 'quota_100' */
  productType: string;
  /** 金额，单位：分 */
  amount: number;
  /** ClawTip 要求的技能标识哈希（slug 的 MD5） */
  indicator: string;
  /** 订单当前状态 */
  status: OrderStatus;
  /** ClawTip 返回的流水号 */
  clawtipTransactionId?: string;
  /** ClawTip 返回的支付凭证 */
  payCredential?: string;
  /** SM4 加密后的数据（传给 ClawTip） */
  encryptedData?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 创建订单请求体 */
export interface CreateOrderRequest {
  userId?: string;
  productType: string;
  amount: number;
  description?: string;
}

/** ClawTip CLI 响应（解析后） */
export interface ClawTipPaymentResponse {
  /** 响应类型：need_auth | success | error */
  type: 'need_auth' | 'success' | 'error';
  /** 授权链接（type=need_auth 时） */
  authUrl?: string;
  /** 支付凭证（type=success 时） */
  payCredential?: string;
  /** ClawTip 交易 ID */
  transactionId?: string;
  /** 错误信息（type=error 时） */
  error?: string;
  /** 原始输出（方便调试，绝不返回给前端） */
  _raw?: string;
}

/** ClawTip 回调通知体（预留） */
export interface ClawTipCallbackBody {
  orderNo: string;
  transactionId: string;
  status: string;
  payCredential?: string;
  sign?: string;
  timestamp?: number;
}
