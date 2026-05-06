/**
 * ClawTip 支付服务 - ClawTipService 核心封装
 *
 * 职责：
 * 1. 调用 ClawTip CLI 发起支付（策略 A）
 * 2. 预留 HTTP API 直调接口（策略 B）
 * 3. SM4 加密订单数据
 * 4. 解析 ClawTip 响应
 * 5. 查询支付状态
 */

import { exec } from 'child_process';
import * as crypto from 'crypto';
import { promisify } from 'util';

import { ClawTipPaymentResponse, ClawTipCallbackBody } from '../types';
import { sm4Encrypt } from '../utils/sm4';
import { buildEncryptPayload, computeIndicator } from '../utils/helpers';

const execAsync = promisify(exec);

/** ClawTip 配置（从环境变量注入） */
interface ClawTipConfig {
  payTo: string;
  sm4Key: string;
  skillVersion: string;
  skillSlug: string;
  callbackUrl: string;
}

/**
 * ClawTipService 核心服务类
 *
 * ⚠️ 安全红线：
 * - sm4Key 只在内部使用，绝不暴露给外部
 * - 不打印到日志
 * - 不出现在 API Response 中
 */
export class ClawTipService {
  private config: ClawTipConfig;

  constructor() {
    this.config = {
      payTo: process.env.CLAWTIP_PAY_TO || '',
      sm4Key: process.env.CLAWTIP_SM4_KEY || '',
      skillVersion: process.env.CLAWTIP_SKILL_VERSION || '1.0.12',
      skillSlug: process.env.CLAWTIP_SKILL_SLUG || '',
      callbackUrl: process.env.CLAWTIP_CALLBACK_URL || '',
    };

    if (!this.config.payTo) {
      console.error('[ClawTip] ⚠️ CLAWTIP_PAY_TO 未配置');
    }
    // 注意：不打印 sm4Key，安全红线
    if (!this.config.sm4Key) {
      console.error('[ClawTip] ⚠️ CLAWTIP_SM4_KEY 未配置');
    }
  }

  /**
   * 获取 indicator（技能标识哈希）
   */
  getIndicator(): string {
    return computeIndicator(this.config.skillSlug);
  }

  /**
   * ========================================
   * 策略 A：通过 CLI 发起支付
   * ========================================
   *
   * 使用 @clawtip/clawtip-cli 的 payment_process.py 脚本。
   * sm4_key 通过环境变量注入，不通过命令行参数传递。
   */
  async executePaymentViaCLI(
    orderNo: string,
    indicator: string,
    amount: number
  ): Promise<ClawTipPaymentResponse> {
    // 先做 SM4 加密
    const encryptedData = sm4Encrypt(
      buildEncryptPayload(orderNo, amount, this.config.payTo),
      this.config.sm4Key
    );

    const version = this.config.skillVersion;

    // 构建 CLI 命令
    // 使用 npx 调用 clawtip 技能中的 payment_process.py
    // sm4_key 通过环境变量 CLAWTIP_SM4_KEY 传递，不进入命令行
    const cmd = [
      'npx',
      '--yes',
      '@clawtip/clawtip-cli@1.0.1',
      'pay',
      `-o${orderNo}`,
      `-i${indicator}`,
      `-v${version}`,
      `-a${amount}`,
    ].join(' ');

    // 通过环境变量注入敏感信息（绝不在命令行中明文传递）
    const env = {
      ...process.env,
      CLAWTIP_SM4_KEY: this.config.sm4Key,
      CLAWTIP_ENCRYPTED_DATA: encryptedData,
      CLAWTIP_PAY_TO: this.config.payTo,
    };

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        env,
        timeout: 30000, // 30 秒超时
        maxBuffer: 1024 * 1024, // 1MB
      });

      if (stderr) {
        // CLI 的 stderr 可能包含调试信息，不打印到日志
        // 但如果 stdout 为空则可能是错误
      }

      return this.parseResponse(stdout || stderr || '');
    } catch (error: any) {
      // CLI 执行失败
      const output = error.stdout || error.stderr || error.message || '';
      const parsed = this.parseResponse(output);

      if (parsed.type === 'error') {
        return parsed;
      }

      return {
        type: 'error',
        error: `CLI 执行失败: ${error.message}`,
      };
    }
  }

  /**
   * ========================================
   * 策略 B：HTTP API 直调（预留）
   * ========================================
   *
   * TODO: 拿到官方开发包后，替换此处逻辑。
   * 官方可能使用国密 SM4 加密请求体，需要将 HTTP 请求逻辑写在这里。
   * 请求体格式和签名算法请参考官方 API 文档。
   */
  async executePaymentViaHTTP(
    orderNo: string,
    indicator: string,
    amount: number
  ): Promise<ClawTipPaymentResponse> {
    // TODO: 实现官方 HTTP API 调用
    // 参考流程：
    // 1. 构建 JSON 请求体
    // 2. 使用 sm4Key 签名/加密请求体
    // 3. 发送 POST 请求到 ClawTip 服务器
    // 4. 解析响应

    console.warn('[ClawTip] HTTP API 直调尚未实现，回退到 CLI 模式');
    return this.executePaymentViaCLI(orderNo, indicator, amount);
  }

  /**
   * 统一支付入口（默认使用 CLI 策略）
   */
  async executePayment(
    orderNo: string,
    indicator: string,
    amount: number
  ): Promise<ClawTipPaymentResponse> {
    return this.executePaymentViaCLI(orderNo, indicator, amount);
  }

  /**
   * ========================================
   * 查询用户授权 / 支付状态
   * ========================================
   *
   * 检查用户是否已完成授权（支付）
   */
  async checkRegister(clawtipId: string): Promise<{
    registered: boolean;
    status?: string;
  }> {
    // TODO: 实现状态查询
    // 可能需要调用 ClawTip 的查询接口
    return { registered: false };
  }

  /**
   * ========================================
   * 响应解析
   * ========================================
   *
   * 将 ClawTip 返回的文本解析为结构化 JSON
   */
  parseResponse(rawOutput: string): ClawTipPaymentResponse {
    const trimmed = rawOutput.trim();

    // 1. 尝试直接 JSON 解析
    try {
      const json = JSON.parse(trimmed);
      return this.normalizeResponse(json);
    } catch {
      // 不是 JSON，继续尝试其他格式
    }

    // 2. 尝试从文本中提取 JSON
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        return this.normalizeResponse(json);
      } catch {
        // 解析失败
      }
    }

    // 3. 尝试匹配授权链接
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return {
        type: 'need_auth',
        authUrl: urlMatch[0],
        _raw: trimmed,
      };
    }

    // 4. 匹配支付凭证
    if (trimmed.includes('payCredential') || trimmed.includes('success')) {
      const credMatch = trimmed.match(/payCredential[=:]\s*["']?([^"'\s,}]+)/);
      return {
        type: 'success',
        payCredential: credMatch?.[1],
        _raw: trimmed,
      };
    }

    // 5. 无法识别，当作错误
    return {
      type: 'error',
      error: trimmed || '无法解析 ClawTip 响应',
      _raw: trimmed,
    };
  }

  /**
   * 标准化 ClawTip 响应
   */
  private normalizeResponse(json: Record<string, any>): ClawTipPaymentResponse {
    // 判断类型
    if (json.error || json.type === 'error') {
      return {
        type: 'error',
        error: json.error || json.message || '未知错误',
        transactionId: json.transactionId || json.txnId,
        _raw: JSON.stringify(json),
      };
    }

    if (json.authUrl || json.url || json.type === 'need_auth') {
      return {
        type: 'need_auth',
        authUrl: json.authUrl || json.url,
        transactionId: json.transactionId || json.txnId,
        _raw: JSON.stringify(json),
      };
    }

    if (json.payCredential || json.type === 'success' || json.status === 'paid') {
      return {
        type: 'success',
        payCredential: json.payCredential || json.credential,
        transactionId: json.transactionId || json.txnId,
        _raw: JSON.stringify(json),
      };
    }

    // 默认当作需要授权
    return {
      type: json.type || 'need_auth',
      authUrl: json.authUrl || json.url,
      payCredential: json.payCredential,
      transactionId: json.transactionId || json.txnId,
      _raw: JSON.stringify(json),
    };
  }

  /**
   * ========================================
   * 回调验签（预留）
   * ========================================
   *
   * 验证 ClawTip 推送的异步通知签名
   */
  verifyCallback(body: ClawTipCallbackBody): boolean {
    // TODO: 实现回调验签
    // 1. 从请求头或 body 中提取签名
    // 2. 使用 sm4Key 验证签名
    // 3. 验证 timestamp 防重放（5 分钟内有效）

    // 临时：简单验证必要字段是否存在
    return !!(body.orderNo && body.transactionId && body.status);
  }
}

/** 全局单例 */
export const clawtipService = new ClawTipService();
