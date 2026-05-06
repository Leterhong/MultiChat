/**
 * ClawTip 支付服务 - 内存订单存储
 *
 * ⚠️ 生产环境请替换为 MySQL / PostgreSQL / Redis
 */

import { Order, OrderStatus } from '../types';

/** 简易内存存储，按 orderNo 索引 */
class OrderStore {
  private orders: Map<string, Order> = new Map();
  private userIdIndex: Map<string, string[]> = new Map();

  /**
   * 存入订单
   */
  save(order: Order): void {
    this.orders.set(order.orderNo, order);

    // 维护 userId 索引
    if (order.userId) {
      const existing = this.userIdIndex.get(order.userId) || [];
      if (!existing.includes(order.orderNo)) {
        existing.push(order.orderNo);
        this.userIdIndex.set(order.userId, existing);
      }
    }
  }

  /**
   * 根据 orderNo 查询
   */
  findByOrderNo(orderNo: string): Order | undefined {
    return this.orders.get(orderNo);
  }

  /**
   * 根据内部 ID 查询
   */
  findById(id: string): Order | undefined {
    for (const order of this.orders.values()) {
      if (order.id === id) return order;
    }
    return undefined;
  }

  /**
   * 查询用户的所有订单（按创建时间倒序）
   */
  findByUserId(userId: string): Order[] {
    const orderNos = this.userIdIndex.get(userId) || [];
    return orderNos
      .map(no => this.orders.get(no))
      .filter((o): o is Order => !!o)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 更新订单
   */
  update(orderNo: string, patch: Partial<Order>): Order | undefined {
    const order = this.orders.get(orderNo);
    if (!order) return undefined;

    Object.assign(order, patch, { updatedAt: new Date() });
    return order;
  }

  /**
   * 更新订单状态
   */
  updateStatus(
    orderNo: string,
    status: OrderStatus,
    extra?: Partial<Order>
  ): Order | undefined {
    return this.update(orderNo, { status, ...extra });
  }

  /**
   * 删除订单（测试用）
   */
  delete(orderNo: string): boolean {
    const order = this.orders.get(orderNo);
    if (!order) return false;

    this.orders.delete(orderNo);
    if (order.userId) {
      const list = this.userIdIndex.get(order.userId) || [];
      this.userIdIndex.set(
        order.userId,
        list.filter(no => no !== orderNo)
      );
    }
    return true;
  }

  /**
   * 获取所有订单数量（监控用）
   */
  get size(): number {
    return this.orders.size;
  }
}

/** 全局单例 */
export const orderStore = new OrderStore();
