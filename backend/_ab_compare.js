/**
 * 精确 A/B 对比：CLI 请求 vs 我的请求
 * 
 * 方案：
 * 1. 创建一个临时订单文件，用 CLI 发起支付
 * 2. 通过 monkey-patch https.request 拦截 CLI 发出的请求体
 * 3. 同时用 initiatePayment 发起同样的请求
 * 4. 对比两个请求体的差异
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 拦截所有 HTTPS POST 请求（仅 clawtipPay 端点）
let capturedRequests = [];
const OriginalRequest = https.request;
https.request = function(urlOrOptions, ...args) {
  const req = OriginalRequest.apply(this, [urlOrOptions, ...args]);
  
  const origWrite = req.write.bind(req);
  req.write = function(data) {
    const urlStr = typeof urlOrOptions === 'string' ? urlOrOptions : 
      (urlOrOptions.hostname + urlOrOptions.path);
    
    if (urlStr.includes('clawtipPay')) {
      try {
        const body = JSON.parse(typeof data === 'string' ? data : data.toString());
        capturedRequests.push({
          url: urlStr,
          body: body,
          headers: req.getHeaders ? req.getHeaders() : {},
          timestamp: Date.now()
        });
        console.log('[INTERCEPT] Captured clawtipPay request');
      } catch(e) {
        console.log('[INTERCEPT] Failed to parse:', e.message);
      }
    }
    return origWrite(data);
  };
  
  return req;
};

// 准备订单文件
const indicator = crypto.createHash('md5').update('my-awesome-skill').digest('hex');
const orderNo = 'CMP' + Date.now();
const ordersDir = path.join(os.homedir(), 'openclaw', 'skills', 'orders', indicator);
fs.mkdirSync(ordersDir, { recursive: true });

const orderFile = path.join(ordersDir, orderNo + '.json');
const orderData = {
  order_no: orderNo,
  amount: '1',
  pay_to: process.env.CLAWTIP_PAY_TO || 'clawtip_d3f4e5f6a7b8c9d0',
  question: '充值 0.01 元',
  description: 'AI服务充值',
  slug: 'my-awesome-skill',
  skill_id: 'blank',
  resource_url: '',
};
fs.writeFileSync(orderFile, JSON.stringify(orderData, null, 2));

console.log('Order file created:', orderFile);

// 执行 CLI 的 dealPayment
console.log('\n=== Running CLI dealPayment ===');

// 直接 require CLI 模块来执行（不通过子进程，这样拦截生效）
async function runCLI() {
  try {
    const npxBase = path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'npm-cache', '_npx'
    );
    
    function findFile(baseDir, target, sub) {
      if (!fs.existsSync(baseDir)) return null;
      try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const full = path.join(baseDir, entry.name);
            if (entry.name === 'clawtip-cli' || entry.name.startsWith('clawtip-cli@')) {
              const t = path.join(full, sub, target);
              if (fs.existsSync(t)) return t;
            }
            const d = findFile(full, target, sub);
            if (d) return d;
          }
        }
      } catch {}
      return null;
    }
    
    const ppPath = findFile(npxBase, 'payment-process.js', 'dist/lib');
    if (!ppPath) { console.log('Cannot find payment-process.js'); return; }
    
    // 清除 require 缓存
    delete require.cache[ppPath];
    const pp = require(ppPath);
    
    // 调用 dealPayment
    const result = await pp.dealPayment(orderNo, indicator);
    console.log('\n=== CLI Result ===');
    console.log(JSON.stringify(result, null, 2));
  } catch(e) {
    console.log('CLI Error:', e.message);
  }
}

// 恢复 https.request
function restoreHttps() {
  https.request = OriginalRequest;
}

// 然后执行我的代码
async function runMyCode() {
  const clawtip = require('./clawtip-direct');
  
  // SM4-ECB 加密
  const ENC_KEY = process.env.CLAWTIP_SM4_KEY || '6c3d6878252e641b';
  let encryptedData = '';
  try {
    const key = Buffer.from(ENC_KEY, 'utf8');
    const data = Buffer.from(JSON.stringify(orderData), 'utf8');
    const cipher = crypto.createCipheriv('sm4-ecb', key, null);
    encryptedData = cipher.update(data).toString('base64') + cipher.final().toString('base64');
  } catch(e) {}
  
  const result = await clawtip.initiatePayment({
    orderNo: orderNo,
    amount: 1,
    payTo: orderData.pay_to,
    encryptedData: encryptedData,
    skillSlug: 'my-awesome-skill',
    skillVersion: '1.0.12',
    description: '充值 0.01 元',
  });
  
  console.log('\n=== My Code Result ===');
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  // 先跑 CLI
  await runCLI();
  
  const cliRequest = capturedRequests.find(r => r.url.includes('clawtipPay'));
  console.log('\n=== CLI clawtipPay Request Body ===');
  if (cliRequest) {
    console.log(JSON.stringify(cliRequest.body, null, 2));
  } else {
    console.log('NO REQUEST CAPTURED');
    console.log('Total captured:', capturedRequests.length);
    for (const r of capturedRequests) {
      console.log(' - ', r.url);
    }
  }
  
  // 清除拦截，然后跑我的代码
  restoreHttps();
  
  // 重新拦截
  let myCapturedRequests = [];
  https.request = function(urlOrOptions, ...args) {
    const req = OriginalRequest.apply(this, [urlOrOptions, ...args]);
    const origWrite = req.write.bind(req);
    req.write = function(data) {
      const urlStr = typeof urlOrOptions === 'string' ? urlOrOptions : 
        (urlOrOptions.hostname + urlOrOptions.path);
      if (urlStr.includes('clawtipPay')) {
        try {
          myCapturedRequests.push(JSON.parse(typeof data === 'string' ? data : data.toString()));
          console.log('[INTERCEPT] Captured MY clawtipPay request');
        } catch(e) {}
      }
      return origWrite(data);
    };
    return req;
  };
  
  await runMyCode();
  
  const myRequest = myCapturedRequests[0];
  console.log('\n=== My clawtipPay Request Body ===');
  if (myRequest) {
    console.log(JSON.stringify(myRequest, null, 2));
  }
  
  // 恢复
  restoreHttps();
  
  // 对比
  if (cliRequest && myRequest) {
    console.log('\n=== DIFF ===');
    compareObjects('root', cliRequest.body, myRequest);
  }
  
  // 清理订单文件
  try { fs.unlinkSync(orderFile); } catch {}
  
  // 保存结果
  const result = {
    cli: cliRequest ? cliRequest.body : null,
    mine: myRequest || null,
  };
  fs.writeFileSync('g:/222/cc/backend/_ab_diff.json', JSON.stringify(result, null, 2));
  console.log('\nDiff saved to _ab_diff.json');
}

function compareObjects(prefix, obj1, obj2) {
  const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
  for (const key of allKeys) {
    const path = prefix + '.' + key;
    const v1 = JSON.stringify(obj1?.[key]);
    const v2 = JSON.stringify(obj2?.[key]);
    
    if (v1 !== v2) {
      console.log(`\n[DIFF] ${path}`);
      console.log('  CLI :', v1.length > 200 ? v1.substring(0, 200) + '...' : v1);
      console.log('  MINE:', v2.length > 200 ? v2.substring(0, 200) + '...' : v2);
      
      // 如果都是对象，递归比较
      if (typeof obj1?.[key] === 'object' && typeof obj2?.[key] === 'object' &&
          obj1?.[key] !== null && obj2?.[key] !== null) {
        compareObjects(path, obj1[key], obj2[key]);
      }
    } else {
      if (v1.length > 100) {
        console.log(`[SAME] ${path}: ${v1.substring(0, 80)}...`);
      }
    }
  }
}

main().catch(console.log);
