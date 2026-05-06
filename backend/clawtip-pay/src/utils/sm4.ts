/**
 * ClawTip 支付服务 - SM4 加密工具
 *
 * 基于官方文档：
 * - 算法：SM4-CBC
 * - 密钥：16 字节，不足补 0
 * - IV：固定值 5f5e5a247f544d77
 * - 填充：PKCS7
 * - 输出：Base64
 *
 * 使用 sm-crypto 库（纯 JS 实现，无需 node-gyp）
 */

import * as crypto from 'crypto';

/** 固定 IV（与官方文档一致） */
const SM4_IV = Buffer.from('5f5e5a247f544d77', 'utf-8');

/**
 * 将密钥处理为 16 字节
 * - 超过 16 字节：截断
 * - 不足 16 字节：右侧补 '0'
 */
function normalizeKey(key: string): Buffer {
  const buf = Buffer.alloc(16, 0x30); // '0' = 0x30
  const keyBuf = Buffer.from(key, 'utf-8');
  keyBuf.copy(buf, 0, 0, Math.min(keyBuf.length, 16));
  return buf;
}

/**
 * PKCS7 填充
 */
function pkcs7Pad(data: Buffer, blockSize: number = 16): Buffer {
  const padLen = blockSize - (data.length % blockSize);
  const padded = Buffer.alloc(data.length + padLen);
  data.copy(padded);
  for (let i = data.length; i < padded.length; i++) {
    padded[i] = padLen;
  }
  return padded;
}

/**
 * SM4-CBC 加密
 *
 * 由于 sm-crypto 的 SM4 模块需要 ECB 或自定义实现，
 * 这里使用 Node.js crypto 模块的 SM4 支持（Node 15+）。
 * 如果当前 Node 版本不支持 SM4，会自动 fallback 到 sm-crypto。
 *
 * @param plaintext 要加密的明文（JSON 字符串）
 * @param key SM4 密钥（字符串形式）
 * @returns Base64 编码的密文
 */
export function sm4Encrypt(plaintext: string, key: string): string {
  const keyBuf = normalizeKey(key);

  // 优先使用 Node.js 内置 crypto（Node 21+ 支持 SM4）
  try {
    const cipher = crypto.createCipheriv('sm4-cbc', keyBuf, SM4_IV);
    const padded = pkcs7Pad(Buffer.from(plaintext, 'utf-8'));
    let encrypted = cipher.update(padded);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('base64');
  } catch {
    // Fallback: 使用 sm-crypto
    return sm4EncryptFallback(plaintext, key);
  }
}

/**
 * Fallback 加密：使用 sm-crypto 库
 */
function sm4EncryptFallback(plaintext: string, key: string): string {
  // sm-crypto 的 SM4 实现
  const { sm4 } = require('sm-crypto');
  const keyBytes = Array.from(normalizeKey(key));
  const ivBytes = Array.from(SM4_IV);

  // PKCS7 填充
  const dataBytes = Buffer.from(plaintext, 'utf-8');
  const padded = pkcs7Pad(dataBytes);
  const dataArr = Array.from(padded);

  // sm-crypto 使用 ECB 模式，我们需要手动实现 CBC
  // 这里将 IV 和数据拼接后使用自定义 CBC
  const encrypted = sm4CbcEncrypt(dataArr, keyBytes, ivBytes);

  return Buffer.from(encrypted).toString('base64');
}

/**
 * 手动实现 SM4-CBC 加密（用于 sm-crypto fallback）
 */
function sm4CbcEncrypt(
  data: number[],
  key: number[],
  iv: number[]
): number[] {
  const { sm4 } = require('sm-crypto');

  const blockSize = 16;
  const result: number[] = [];
  let prevBlock = [...iv];

  for (let i = 0; i < data.length; i += blockSize) {
    const block = data.slice(i, i + blockSize);
    // 补齐到 16 字节
    while (block.length < blockSize) block.push(0);

    // XOR with previous ciphertext block (or IV for first block)
    const xored = block.map((b, idx) => b ^ prevBlock[idx]);

    // SM4 ECB encrypt
    const encrypted = sm4.encrypt(xored, key);

    result.push(...encrypted);
    prevBlock = encrypted;
  }

  return result;
}
