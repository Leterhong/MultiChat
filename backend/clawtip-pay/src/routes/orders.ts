/**
 * ClawTip 支付服务 - 订单路由
 *
 * POST   /api/orders            → 创建订单
 * POST   /api/orders/:orderNo/pay → 发起支付
 * GET    /api/orders/:orderNo/status → 查询订单状态
 */

import { Router, Request, Response } from 'express';
import { OrderStatus, CreateOrderRequest } from '../types';
import { orderStore } from '../store/OrderStore';
import { clawtipService } from '../services/ClawTipService';
import { generateOrderNo, generateOrderId, buildEncryptPayload } from '../utils/helpers';
import { sm4Encrypt } from '../utils/sm4';

const router = Router();

/**
 * POST /api/orders
 * 创建订单
 */
router.post('/', (req: Request, res: Response) => {
  const body = req.body as CreateOrderRequest;

  // ── 参数校验 ──
  if (!body.productType || typeof body.productType !== 'string') {
    res.status(400).json({
      code: 'INVALID_PARAMS',
      message: 'productType 为必填字段',
    });
    return;
  }

  if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
    res.status(400).json({
      code: 'INVALID_PARAMS',
      message: 'amount 必须为正数（单位：分）',
    });
    return;
  }

  if (body.amount > 1000000) {
    res.status(400).json({
      code: 'INVALID_PARAMS',
      message: '单笔订单金额不能超过 10000 元（1000000 分）',
    });
    return;
  }

  // ── 生成订单 ──
  const orderNo = generateOrderNo();
  const id = generateOrderId();
  const indicator = clawtipService.getIndicator();

  // SM4 加密订单数据
  const encryptedData = sm4Encrypt(
    buildEncryptPayload(orderNo, body.amount, process.env.CLAWTIP_PAY_TO || ''),
    process.env.CLAWTIP_SM4_KEY || ''
  );

  const order = {
    id,
    orderNo,
    userId: body.userId || '',
    productType: body.productType,
    amount: body.amount,
    indicator,
    status: OrderStatus.Pending,
    encryptedData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ── 存储并返回 ──
  orderStore.save(order);

  // 返回给前端（不包含 encryptedData 等敏感字段）
  res.status(201).json({
    code: 'SUCCESS',
    data: {
      orderId: order.id,
      orderNo: order.orderNo,
      indicator: order.indicator,
      status: order.status,
      amount: order.amount,
    },
  });
});

/**
 * POST /api/orders/:orderNo/pay
 * 发起支付（后端调用 ClawTip CLI）
 */
router.post('/:orderNo/pay', async (req: Request, res: Response) => {
  const { orderNo } = req.params;
  const order = orderStore.findByOrderNo(orderNo);

  // ── 订单校验 ──
  if (!order) {
    res.status(404).json({
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在',
    });
    return;
  }

  if (order.status === OrderStatus.Success) {
    res.status(400).json({
      code: 'ORDER_ALREADY_PAID',
      message: '订单已支付成功，请勿重复支付',
    });
    return;
  }

  // ── 更新状态为支付中 ──
  orderStore.updateStatus(orderNo, OrderStatus.Paying);

  try {
    // 调用 ClawTip 发起支付
    const result = await clawtipService.executePayment(
      order.orderNo,
      order.indicator,
      order.amount
    );

    // 根据响应类型更新订单
    if (result.type === 'success' && result.payCredential) {
      orderStore.update(orderNo, {
        status: OrderStatus.Success,
        clawtipTransactionId: result.transactionId,
        payCredential: result.payCredential,
      });
    } else if (result.type === 'error') {
      orderStore.updateStatus(orderNo, OrderStatus.Failed);
    }

    // 透传给前端（不包含 _raw 等内部字段）
    const { _raw, ...safeResponse } = result;

    res.json({
      code: 'SUCCESS',
      data: safeResponse,
    });
  } catch (error: any) {
    orderStore.updateStatus(orderNo, OrderStatus.Failed);

    // 统一错误处理（不暴露堆栈）
    console.error('[Orders] 支付异常:', error.message);
    res.status(500).json({
      code: 'PAYMENT_ERROR',
      message: '支付发起失败，请稍后重试',
    });
  }
});

/**
 * GET /api/orders/:orderNo/status
 * 查询订单状态
 */
router.get('/:orderNo/status', (req: Request, res: Response) => {
  const { orderNo } = req.params;
  const order = orderStore.findByOrderNo(orderNo);

  if (!order) {
    res.status(404).json({
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在',
    });
    return;
  }

  // 返回订单信息（不包含 encryptedData、payCredential 等敏感字段）
  res.json({
    code: 'SUCCESS',
    data: {
      orderId: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      productType: order.productType,
      amount: order.amount,
      indicator: order.indicator,
      status: order.status,
      clawtipTransactionId: order.clawtipTransactionId,
      paid: order.status === OrderStatus.Success,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

export default router;
