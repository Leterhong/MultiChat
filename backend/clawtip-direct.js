/**
 * ClawTip HTTP 直调模块 v2
 * 完全绕过 CLI，直接调用 ClawTip 后端 API
 *
 * 正确协议链路（逆向 CLI 源码）：
 * 1. getSMPublicKey → 获取 SM2 公钥（在 .data.resultData 中）
 * 2. encrypt(userToken, publicKey) → 用 CLI 内置 encrypt 模块加密 token
 * 3. clawtipPay → 构建 X402 PaymentRequest（加密 token 放入 Authorization.from），发起支付
 *
 * 响应结构：
 * {
 *   success: true/false,
 *   resultCode: 0,
 *   resultMsg: "成功",
 *   resultData: {
 *     authUrl: "https://...",     // 授权/支付 URL
 *     urlType: "OPEN"|"RISK",    // URL 类型
 *     message: "返回消息",
 *     payCredential: "..."       // SM4 加密的支付凭证
 *   }
 * }
 */

const https = require('https');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ── ClawTip API 端点 ─────────────────────────────────────────────────
const API = {
  GET_PUBLIC_KEY: 'https://ms.jr.jd.com/gw2/generic/hyqy/h5/m/getSMPublicKey',
  CLAWTIP_PAY: 'https://ms.jr.jd.com/gw2/generic/hyqy/h5/m/clawtipPay',
};

// ── 加载 CLI 内置的加密模块 ──────────────────────────────────────────
let summerCrypticoEncrypt = null;

function loadEncryptModule() {
  if (summerCrypticoEncrypt) return;

  const possiblePaths = [
    path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'npm-cache', '_npx'
    ),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@clawtip', 'clawtip-cli'),
    path.join(__dirname, 'node_modules', '@clawtip', 'clawtip-cli'),
  ];

  for (const base of possiblePaths) {
    try {
      const encryptPath = findFileRecursive(base, 'encrypt.js', 'dist/lib');
      if (encryptPath) {
        const mod = require(encryptPath);
        summerCrypticoEncrypt = mod.encrypt;
        console.log('[ClawTip-Direct] Loaded encrypt module from:', encryptPath);
        return;
      }
    } catch (e) {
      // continue
    }
  }

  throw new Error(
    '无法加载 ClawTip encrypt 模块。请确保 @clawtip/clawtip-cli 已通过 npx 下载过一次。'
  );
}

function findFileRecursive(baseDir, targetFile, subPath) {
  if (!fs.existsSync(baseDir)) return null;
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const full = path.join(baseDir, entry.name);
        if (entry.name === 'clawtip-cli' || entry.name.startsWith('clawtip-cli@')) {
          const target = path.join(full, subPath, targetFile);
          if (fs.existsSync(target)) return target;
        }
        const deep = findFileRecursive(full, targetFile, subPath);
        if (deep) return deep;
      }
    }
  } catch {}
  return null;
}

// ── 加载 CLI 的 payment-request.js（X402 协议） ──────────────────────
let PaymentRequestClasses = null;

function loadPaymentRequestModule() {
  if (PaymentRequestClasses) return;

  const possiblePaths = [
    path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'npm-cache', '_npx'
    ),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@clawtip', 'clawtip-cli'),
    path.join(__dirname, 'node_modules', '@clawtip', 'clawtip-cli'),
  ];

  for (const base of possiblePaths) {
    try {
      const prPath = findFileRecursive(base, 'payment-request.js', 'dist/lib');
      if (prPath) {
        PaymentRequestClasses = require(prPath);
        console.log('[ClawTip-Direct] Loaded payment-request module from:', prPath);
        return;
      }
    } catch {}
  }

  throw new Error('无法加载 ClawTip payment-request 模块');
}

// ── 加载 CLI 的 config.js ────────────────────────────────────────────
function getConfig() {
  const configPath = path.join(os.homedir(), '.openclaw', 'configs', 'config.json');
  if (!fs.existsSync(configPath)) throw new Error('未找到 ClawTip 用户配置: ' + configPath);
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function getUserToken() {
  const config = getConfig();
  if (!config.u) throw new Error('ClawTip 用户令牌不存在，请先运行 create-token');
  return config.u;
}

// ── 收集设备信息（同 CLI 的 device-info.js） ─────────────────────────
function collectBizInfo() {
  const machineId = getMachineId();
  const nets = [];
  const ifaces = os.networkInterfaces();
  for (const [name, entries] of Object.entries(ifaces || {})) {
    for (const entry of entries || []) {
      if (entry.mac && entry.mac !== '00:00:00:00:00:00') {
        nets.push({ name, mac: entry.mac, family: entry.family, address: entry.address, internal: entry.internal });
      }
    }
  }
  return {
    hostname: os.hostname(),
    machineId,
    address: nets,
    platform: os.platform(),
    release: os.release(),
    version: os.version() || ''
  };
}

function getMachineId() {
  try {
    const uuid = require('child_process').execSync(
      'powershell.exe -ExecutionPolicy bypass -command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"',
      { encoding: 'utf-8' }
    ).trim();
    return uuid ? crypto.createHash('sha256').update(uuid).digest('hex') : '';
  } catch {
    try {
      const uuid = require('child_process').execSync('wmic csproduct get uuid', { encoding: 'utf-8' })
        .split('\n').map(s => s.trim()).filter(Boolean);
      const id = uuid.length > 1 ? uuid[1] : '';
      return id ? crypto.createHash('sha256').update(id).digest('hex') : '';
    } catch {
      return '';
    }
  }
}

// ── HTTPS POST 请求工具 ─────────────────────────────────────────────
function httpsPost(url, data, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = typeof data === 'string' ? data : JSON.stringify(data);
    const isForm = data && typeof data === 'object' && !Array.isArray(data) && data.clientKey !== undefined;

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.write(postData);
    req.end();
  });
}

// ── 核心：发起支付 ───────────────────────────────────────────────────
/**
 * 直接调用 ClawTip 后端 API 发起支付
 *
 * 流程（逆向自 clawtip-pay.js dealPayment 函数）：
 * 1. getSMPublicKey → 取 .data.resultData 作为 SM2 公钥
 * 2. encrypt(userToken, publicKey) → 加密用户 token
 * 3. 构建 X402 PaymentRequest，加密 token 放入 Authorization.from
 * 4. POST clawtipPay → 取 .data.resultData 作为响应
 *
 * @param {Object} params
 * @param {string} params.orderNo       - 订单号
 * @param {number} params.amount        - 金额（分）
 * @param {string} params.payTo         - 收款方 ID
 * @param {string} params.encryptedData - SM4-ECB 加密的订单数据
 * @param {string} params.skillSlug     - 技能 slug
 * @param {string} params.skillVersion  - 技能版本
 * @param {string} params.description   - 订单描述
 * @returns {Promise<{type: 'success'|'need_auth'|'error', authUrl?: string, payCredential?: string, error?: string}>}
 */
async function initiatePayment(params) {
  const {
    orderNo,
    amount,
    payTo,
    encryptedData,
    skillSlug,
    skillVersion = '1.0.1',  // 必须是 1.0.1（ClawTip 后端只认这个版本号）
    description = 'AI服务充值',
  } = params;

  // 加载模块
  loadEncryptModule();
  loadPaymentRequestModule();

  const userToken = getUserToken();
  const bizInfo = collectBizInfo();

  // ─── Step 1: 获取 SM2 公钥 ───
  // CLI: const i = (await e.post(n, {}, {timeout: 1e4})).data;
  //      const t = i.resultData || JSON.stringify(i);
  //      return t;  // t 就是公钥字符串
  console.log('[ClawTip-Direct] Step 1: getSMPublicKey...');
  const pubKeyResp = await httpsPost(API.GET_PUBLIC_KEY, {});
  console.log('[ClawTip-Direct] getSMPublicKey response:', JSON.stringify(pubKeyResp).substring(0, 300));

  // 公钥在 response.data.resultData（axios 自动解析 .data）
  // 但我们用原生 https，所以响应直接就是 axios 的 .data
  const publicKey = pubKeyResp?.resultData || JSON.stringify(pubKeyResp);
  if (!publicKey) {
    throw new Error('获取 SM2 公钥失败: ' + JSON.stringify(pubKeyResp).substring(0, 200));
  }

  console.log('[ClawTip-Direct] Got public key (resultData), length:', publicKey.length);

  // ─── Step 2: 加密用户 token ───
  // CLI: P && (B = i(P, D), console.log("成功对 u 进行了加密。"))
  // 其中 i 是 encrypt 函数，P 是 userToken，D 是公钥
  console.log('[ClawTip-Direct] Step 2: Encrypting user token...');
  let encryptedToken = '';
  try {
    encryptedToken = summerCrypticoEncrypt(userToken, publicKey);
    console.log('[ClawTip-Direct] Token encrypted successfully, length:', encryptedToken.length);
  } catch (encErr) {
    console.error('[ClawTip-Direct] Token encryption failed:', encErr.message);
    throw new Error('加密用户 token 失败: ' + encErr.message);
  }

  // ─── Step 3: 构建 X402 PaymentRequest 并发起支付 ───
  console.log('[ClawTip-Direct] Step 3: clawtipPay...');
  const PR = PaymentRequestClasses;
  const { v4: uuidv4 } = require('crypto'); // fallback if no uuid

  // Accepted（CLI 使用 eip155:84532 网络）
  const accepted = new PR.Accepted({
    payTo,
    amount: String(amount),
    network: 'eip155:84532',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  });

  // Authorization — 加密后的 token 放在 from 字段！
  const authorization = new PR.Authorization({
    from: encryptedToken,  // ← CLI 的关键做法
    to: payTo,
    value: String(amount),
    nonce: generateNonce(),
  });

  // Payload
  const payload = new PR.Payload({
    signature: '',  // CLI 传空字符串
    authorization,
  });

  // Resource
  const resource = new PR.Resource({
    url: '',
    description: description,
    mimeType: 'application/json',
  });

  // Extensions（必须与 CLI 保持一致的字段值）
  const extensions = new PR.Extensions({
    orderNo,
    askedContents: description || '',  // CLI 从订单文件的 question 字段读取
    deviceId: encryptedToken,  // CLI 用加密后的 token 作为 deviceId
    skillId: 'blank',  // CLI 默认传 'blank'（来自订单文件的 skill_id）
    slug: skillSlug,
    skillVersion,
    encryptedData,
    bizInfo,
    openclawVersion: '',  // CLI 默认空字符串（openclaw CLI 未安装时）
  });

  // PaymentRequest（CLI 传入 systemId 和 systemToken）
  const paymentRequest = new PR.PaymentRequest({
    accepted,
    payload,
    resource,
    extensions,
    systemId: 'jd-clawtip',
    systemToken: 'jd-clawtip',
  });

  const requestBody = paymentRequest.toDict();
  console.log('[ClawTip-Direct] PaymentRequest keys:', Object.keys(requestBody));

  const payResp = await httpsPost(API.CLAWTIP_PAY, requestBody);
  console.log('[ClawTip-Direct] clawtipPay response:', JSON.stringify(payResp).substring(0, 500));

  // ─── 解析支付响应 ───
  // CLI 的响应结构：
  // n.data = { resultData, success, resultCode, resultMsg }
  // resultData = { authUrl, urlType, message, payCredential }
  const success = payResp?.success;
  const resultMsg = payResp?.resultMsg || '';

  // resultData 可能是字符串（JSON）或对象
  let resultData = payResp?.resultData;
  if (typeof resultData === 'string') {
    try {
      resultData = JSON.parse(resultData);
    } catch {
      resultData = {};
    }
  }
  resultData = resultData || {};

  // 检查业务错误码
  const resultCode = resultData?.code || '';
  if (resultCode === 'CT000035') {
    const msg = resultData?.message || 'clawtip 版本需要升级';
    console.error('[ClawTip-Direct] 版本升级要求:', msg);
    return { type: 'need_upgrade', error: msg, code: resultCode };
  }
  if (resultCode === '000001' || resultCode === 'ACC3010001') {
    const msg = resultData?.message || '支付请求被拒绝';
    console.error('[ClawTip-Direct] 支付拒绝:', resultCode, msg);
    return { type: 'error', error: msg, code: resultCode };
  }

  if (!success) {
    const msg = resultData?.message || resultMsg || '未知错误';
    console.error('[ClawTip-Direct] Pay returned success=false:', msg);
    return { type: 'error', error: msg };
  }

  // 检查 authUrl（需要用户扫码/授权）
  const authUrl = resultData?.authUrl;
  if (authUrl) {
    const urlType = resultData?.urlType || 'OPEN';
    console.log('[ClawTip-Direct] Got authUrl, urlType:', urlType);

    if (urlType === 'RISK') {
      // 风控需要鉴权
      console.log('[ClawTip-Direct] Risk auth required');
    } else {
      // OPEN — 正常授权链接
      console.log('[ClawTip-Direct] Open auth URL:', authUrl.substring(0, 100) + '...');
    }

    return { type: 'need_auth', authUrl };
  }

  // 检查 message（可能是错误消息或成功消息）
  const message = resultData?.message || '';
  if (message) {
    console.log('[ClawTip-Direct] 返回消息:', message);
  }

  // 检查 payCredential
  const payCredential = resultData?.payCredential;
  if (payCredential) {
    const payStatus = resultData?.payStatus;
    console.log('[ClawTip-Direct] Got payCredential, payStatus:', payStatus);

    if (payStatus === 'FAIL') {
      // 支付失败，返回错误原因
      const failReason = resultData?.message || resultData?.failReason || '支付失败';
      console.error('[ClawTip-Direct] Payment FAIL:', failReason);
      return { type: 'error', error: failReason, payCredential, payStatus };
    }

    return { type: 'success', payCredential };
  }

  // 有 authUrl 但可能被遗漏
  if (message && !payCredential) {
    // 检查是否是失败消息
    if (message.includes('失败') || message.includes('不能相同') || message.includes('错误')) {
      return { type: 'error', error: message };
    }
  }

  // 未知响应
  return { type: 'error', error: '未知支付响应: ' + JSON.stringify(payResp).substring(0, 300) };
}

function generateNonce() {
  // UUID v4 without dashes (同 CLI 的做法)
  const uuid = crypto.randomUUID();
  return uuid.replace(/-/g, '');
}

module.exports = { initiatePayment, getUserToken, collectBizInfo, getConfig };
