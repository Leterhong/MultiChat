/**
 * ClawTip 支付服务 - ClawTip 回调路由
 *
 * POST /api/clawtip/callback → ClawTip 异步通知回调
 */

import { Router, Request, Response } from 'express';
import { OrderStatus, ClawTipCallbackBody } from '../types';
import { orderStore } from '../store/OrderStore';
import { clawtipService } from '../services/ClawTipService';

const router = Router();

/**
 * POST /api/clawtip/callback
 * ClawTip 异步回调通知（预留）
 *
 * ClawTip 在支付状态变更时会向此地址推送通知。
 */
router.post('/callback', (req: Request, res: Response) => {
  const body = req.body as ClawTipCallbackBody;

  console.log('[ClawTip Callback] 收到通知:', {
    orderNo: body.orderNo,
    transactionId: body.transactionId,
    status: body.status,
    hasSign: !!body.sign,
  });

  // ── 验签（预留） ──
  if (!clawtipService.verifyCallback(body)) {
    res.status(400).json({ code: 'INVALID_SIGNATURE', message: '签名验证失败' });
    return;
  }

  // ── 防重放校验 ──
  if (body.timestamp) {
    const now = Date.now();
    const diff = now - body.timestamp;
    if (diff > 5 * 60 * 1000) {
      // 超过 5 分钟认为过期
      res.status(400).json({ code: 'EXPIRED', message: '通知已过期' });
      return;
    }
  }

  // ── 查找订单 ──
  if (!body.orderNo) {
    res.status(400).json({ code: 'MISSING_ORDER_NO', message: '缺少 orderNo' });
    return;
  }

  const order = orderStore.findByOrderNo(body.orderNo);
  if (!order) {
    console.warn('[ClawTip Callback] 订单不存在:', body.orderNo);
    // 仍然返回 SUCCESS，避免 ClawTip 重复推送
    res.send('SUCCESS');
    return;
  }

  // ── 更新订单状态 ──
  const statusMap: Record<string, OrderStatus> = {
    paid: OrderStatus.Success,
    success: OrderStatus.Success,
    failed: OrderStatus.Failed,
    cancelled: OrderStatus.Failed,
  };

  const newStatus = statusMap[body.status?.toLowerCase()];
  if (newStatus) {
    orderStore.update(body.orderNo, {
      status: newStatus,
      clawtipTransactionId: body.transactionId,
      payCredential: body.payCredential,
    });
    console.log('[ClawTip Callback] 订单状态更新:', body.orderNo, '→', newStatus);
  }

  // ── 返回 SUCCESS ──
  res.send('SUCCESS');
});

export default router;
