const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createAdapter } = require('./adapters');

// ── Load .env from clawtip-pay (if exists) ─────────────────────────────
try {
  const envPath = path.join(__dirname, 'clawtip-pay', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
  console.log('[ClawTip] .env loaded from', envPath);
} catch (e) {
  console.log('[ClawTip] No .env found, using env vars');
}

const CLAWTIP_PAY_TO = process.env.CLAWTIP_PAY_TO || '';
const CLAWTIP_SM4_KEY_BASE64 = process.env.CLAWTIP_SM4_KEY || '';
const CLAWTIP_SKILL_SLUG = process.env.CLAWTIP_SKILL_SLUG || 'my-awesome-skill';
const CLAWTIP_SKILL_VERSION = process.env.CLAWTIP_SKILL_VERSION || '1.0.12';

// ── SM4 ECB Encryption / Decryption (Hutool compatible) ────────────────
// 官方 Java 示例用 Hutool SmUtil.sm4(keyBytes)，默认 ECB + PKCS5Padding
// 密钥为 Base64 编码的 16 字节
function getSm4KeyBytes() {
  return Buffer.from(CLAWTIP_SM4_KEY_BASE64, 'base64');
}

function sm4Encrypt(plaintext) {
  // Node.js crypto SM4 (Node 21+), fallback to error
  try {
    const key = getSm4KeyBytes();
    const cipher = crypto.createCipheriv('sm4-ecb', key, null);
    let encrypted = cipher.update(plaintext, 'utf-8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('base64');
  } catch (e) {
    console.error('[SM4] Encrypt failed:', e.message);
    // Fallback: 使用 sm-crypto 库（如果已安装）
    try {
      const { sm4 } = require('sm-crypto');
      const keyArr = Array.from(getSm4KeyBytes());
      const dataArr = Array.from(Buffer.from(plaintext, 'utf-8'));
      const encrypted = sm4.encrypt(dataArr, keyArr);
      return Buffer.from(encrypted).toString('base64');
    } catch (e2) {
      throw new Error('SM4 加密失败: ' + e2.message + ' (需要 Node.js 21+ 或安装 sm-crypto)');
    }
  }
}

function sm4Decrypt(encryptedBase64) {
  try {
    const key = getSm4KeyBytes();
    const decipher = crypto.createDecipheriv('sm4-ecb', key, null);
    let decrypted = decipher.update(Buffer.from(encryptedBase64, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (e) {
    console.error('[SM4] Decrypt failed:', e.message);
    try {
      const { sm4 } = require('sm-crypto');
      const keyArr = Array.from(getSm4KeyBytes());
      const dataArr = Array.from(Buffer.from(encryptedBase64, 'base64'));
      const decrypted = sm4.decrypt(dataArr, keyArr);
      return Buffer.from(decrypted).toString('utf-8');
    } catch (e2) {
      throw new Error('SM4 解密失败: ' + e2.message);
    }
  }
}

// ── ClawTip Indicator (MD5 of slug) ────────────────────────────────────
function getIndicator() {
  return crypto.createHash('md5').update(CLAWTIP_SKILL_SLUG, 'utf-8').digest('hex');
}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Persistence helpers ──────────────────────────────────────────────
function readJson(file, fallback) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return fallback; }
}
function writeJson(file, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ── Provider CRUD ────────────────────────────────────────────────────
app.get('/api/providers', (req, res) => {
  res.json(readJson('providers.json', []));
});
app.post('/api/providers', (req, res) => {
  const providers = readJson('providers.json', []);
  const provider = { id: Date.now().toString(36), ...req.body };
  providers.push(provider);
  writeJson('providers.json', providers);
  res.json(provider);
});
app.put('/api/providers/:id', (req, res) => {
  const providers = readJson('providers.json', []);
  const idx = providers.findIndex(p => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  providers[idx] = { ...providers[idx], ...req.body, id: req.params.id };
  writeJson('providers.json', providers);
  res.json(providers[idx]);
});
app.delete('/api/providers/:id', (req, res) => {
  let providers = readJson('providers.json', []);
  providers = providers.filter(p => p.id !== req.params.id);
  writeJson('providers.json', providers);
  res.json({ ok: true });
});

// ── Models: list all models grouped by provider ──────────────────────
app.get('/api/models', (req, res) => {
  const providers = readJson('providers.json', []);
  const models = [];
  for (const p of providers) {
    (p.models || []).forEach(m => {
      models.push({ id: `${p.id}:${m}`, name: m, providerId: p.id, providerName: p.name });
    });
  }
  res.json(models);
});

// ── Local model discovery (Ollama / LM Studio) ───────────────────────
app.post('/api/fetch-local-models', async (req, res) => {
  const { apiType, baseUrl } = req.body || {};
  if (!apiType || !baseUrl) {
    return res.status(400).json({ error: 'apiType and baseUrl are required' });
  }

  try {
    if (apiType === 'ollama') {
      // Ollama native tags endpoint
      const url = `${baseUrl.replace(/\/+$/, '')}/api/tags`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return res.status(resp.status).json({ error: `Ollama returned HTTP ${resp.status}` });
      const data = await resp.json();
      // data.models is an array of { name, model, ... }
      const models = (data.models || []).map(m => m.name || m.model).filter(Boolean);
      return res.json({ models });
    }

    if (apiType === 'lmstudio') {
      // LM Studio uses OpenAI-compatible /v1/models
      const url = `${baseUrl.replace(/\/+$/, '')}/v1/models`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return res.status(resp.status).json({ error: `LM Studio returned HTTP ${resp.status}` });
      const data = await resp.json();
      const models = (data.data || []).map(m => m.id).filter(Boolean);
      return res.json({ models });
    }

    res.status(400).json({ error: `Unsupported apiType for local discovery: ${apiType}` });
  } catch (e) {
    res.status(502).json({ error: `Cannot connect to ${baseUrl}: ${e.message}` });
  }
});


app.post('/v1/chat/completions', async (req, res) => {
  const body = req.body;
  const requestedModel = body.model || '';

  // ── 技能消息计费：有 _skillId 时要求登录并扣余额 ──────────────────
  let chargedUserId = null;
  const SKILL_MSG_COST = 1; // 每条技能消息扣 1 分（即 ¥0.01）
  if (body._skillId) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: { message: '使用技能需要先登录', code: 'LOGIN_REQUIRED' } });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const users = readUsers();
      const userIdx = users.findIndex(u => u.id === decoded.userId);
      if (userIdx < 0) {
        return res.status(401).json({ error: { message: '用户不存在', code: 'USER_NOT_FOUND' } });
      }
      if ((users[userIdx].balance || 0) < SKILL_MSG_COST) {
        return res.status(402).json({ error: { message: '余额不足，请先充值', code: 'BALANCE_INSUFFICIENT', balance: users[userIdx].balance || 0, cost: SKILL_MSG_COST } });
      }
      // 扣减余额
      users[userIdx].balance -= SKILL_MSG_COST;
      writeUsers(users);
      chargedUserId = decoded.userId;
      console.log(`[Billing] Skill msg: user=${decoded.userId}, skillId=${body._skillId}, cost=${SKILL_MSG_COST}分, newBalance=${users[userIdx].balance}`);
    } catch (e) {
      if (e.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: { message: '登录已过期，请重新登录', code: 'TOKEN_EXPIRED' } });
      }
      return res.status(401).json({ error: { message: '认证失败', code: 'AUTH_FAILED' } });
    }
  }

  // model format: "providerId:modelName" or plain "modelName"
  // modelName may contain colons (e.g. Ollama: "llama3:latest")
  const colonIdx = requestedModel.indexOf(':');
  let providerId, modelName;
  if (colonIdx > 0) {
    providerId = requestedModel.substring(0, colonIdx);
    modelName = requestedModel.substring(colonIdx + 1);
  } else {
    modelName = requestedModel;
    providerId = null;
  }

  // 优先使用前端传来的 provider 配置（_provider 字段）
  // 兼容 IndexedDB 前端存储 + providers.json 后端存储
  console.log('[DEBUG] body._provider =', body._provider ? 'present (' + body._provider.id + ', ' + body._provider.apiType + ')' : 'MISSING', '| providerId from model =', providerId, '| model =', requestedModel);
  let provider = body._provider || null;

  if (!provider && providerId) {
    // 回退到 providers.json 文件查找
    const providers = readJson('providers.json', []);
    provider = providers.find(p => p.id === providerId) || null;
  }

  // 最后防线：如果 _provider 字段存在但缺少关键字段，补全
  if (provider && !provider.apiType) {
    // 无法确定适配器类型，根据 providerId 后缀或 baseUrl 猜测
    if (provider.baseUrl && provider.baseUrl.includes('localhost:1234')) {
      provider.apiType = 'lmstudio';
    } else if (provider.baseUrl && provider.baseUrl.includes('localhost:11434')) {
      provider.apiType = 'ollama';
    } else {
      provider.apiType = 'openai';
    }
    console.log('[DEBUG] Inferred apiType =', provider.apiType, 'for provider', provider.id);
  }

  if (!provider && providerId) {
    return res.status(400).json({ error: { message: `Provider "${providerId}" not found` } });
  }

  if (!provider) {
    return res.status(400).json({ error: { message: 'No provider specified and no provider config in request body' } });
  }

  const stream = body.stream === true;

  try {
    // Create adapter for this provider
    const adapter = createAdapter(provider);

    // Prepare (e.g., get access token for Wenxin)
    await adapter.prepare();

    // Build request
    const upstreamUrl = adapter.getEndpoint();
    const upstreamBody = adapter.buildRequestBody(modelName, body.messages, stream, {
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      top_p: body.top_p
    });

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: adapter.getHeaders(),
      body: JSON.stringify(upstreamBody),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).type('application/json').send(errText);
    }

    if (stream) {
      // SSE with adapter transformation
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;

              const transformed = adapter.transformSSEChunk(line);
              if (transformed) {
                res.write(`data: ${JSON.stringify(transformed)}\n\n`);
              }
            }
          }
        } catch (e) {
          console.error('Stream read error:', e.message);
        } finally {
          // 如果是技能消息，在流结束前发送扣费通知
          if (chargedUserId) {
            const users = readUsers();
            const user = users.find(u => u.id === chargedUserId);
            const newBalance = user ? user.balance : 0;
            res.write(`data: ${JSON.stringify({ billing: { cost: SKILL_MSG_COST, balance: newBalance } })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
        }
      })();
    } else {
      const data = await upstream.json();
      const transformed = adapter.transformResponse(data);
      // 技能消息：在响应体附加扣费信息
      if (chargedUserId) {
        const users = readUsers();
        const user = users.find(u => u.id === chargedUserId);
        const newBalance = user ? user.balance : 0;
        transformed._billing = { cost: SKILL_MSG_COST, balance: newBalance };
      }
      res.json(transformed);
    }
  } catch (err) {
    console.error('Upstream error:', err.message);
    res.status(502).json({ error: { message: `Upstream request failed: ${err.message}` } });
  }
});

// ── Conversations CRUD ────────────────────────────────────────────────
app.get('/api/conversations', (req, res) => {
  res.json(readJson('conversations.json', []));
});
app.get('/api/conversations/:id', (req, res) => {
  const convs = readJson('conversations.json', []);
  const conv = convs.find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: 'not found' });
  const messages = readJson(`messages_${req.params.id}.json`, []);
  res.json({ ...conv, messages });
});
app.post('/api/conversations', (req, res) => {
  const convs = readJson('conversations.json', []);
  const conv = {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    compareMode: false,
    modelA: '',
    modelB: '',
    systemPrompt: '',
    inputPlaceholder: '',
    ...req.body,
  };
  convs.unshift(conv);
  writeJson('conversations.json', convs);
  writeJson(`messages_${conv.id}.json`, []);
  res.json(conv);
});
app.put('/api/conversations/:id', (req, res) => {
  const convs = readJson('conversations.json', []);
  const idx = convs.findIndex(c => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  convs[idx] = { ...convs[idx], ...req.body, id: req.params.id };
  writeJson('conversations.json', convs);
  res.json(convs[idx]);
});
app.delete('/api/conversations/:id', (req, res) => {
  let convs = readJson('conversations.json', []);
  convs = convs.filter(c => c.id !== req.params.id);
  writeJson('conversations.json', convs);
  const mp = path.join(DATA_DIR, `messages_${req.params.id}.json`);
  if (fs.existsSync(mp)) fs.unlinkSync(mp);
  res.json({ ok: true });
});
// Save messages for a conversation
app.post('/api/conversations/:id/messages', (req, res) => {
  const convs = readJson('conversations.json', []);
  if (!convs.find(c => c.id === req.params.id)) return res.status(404).json({ error: 'not found' });
  writeJson(`messages_${req.params.id}.json`, req.body);
  res.json({ ok: true });
});

// ── Prompt Templates ──────────────────────────────────────────────────
app.get('/api/prompts', (req, res) => {
  const file = path.join(__dirname, 'prompts.json');
  if (!fs.existsSync(file)) return res.json([]);
  try { res.json(JSON.parse(fs.readFileSync(file, 'utf-8'))); }
  catch { res.json([]); }
});

// ── Assistants CRUD ───────────────────────────────────────────────────
app.get('/api/assistants', (req, res) => {
  res.json(readJson('assistants.json', []));
});
app.post('/api/assistants', (req, res) => {
  const assistants = readJson('assistants.json', []);
  const assistant = { id: Date.now().toString(36), ...req.body };
  assistants.push(assistant);
  writeJson('assistants.json', assistants);
  res.json(assistant);
});
app.put('/api/assistants/:id', (req, res) => {
  const assistants = readJson('assistants.json', []);
  const idx = assistants.findIndex(a => a.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  assistants[idx] = { ...assistants[idx], ...req.body, id: req.params.id };
  writeJson('assistants.json', assistants);
  res.json(assistants[idx]);
});
app.delete('/api/assistants/:id', (req, res) => {
  let assistants = readJson('assistants.json', []);
  assistants = assistants.filter(a => a.id !== req.params.id);
  writeJson('assistants.json', assistants);
  res.json({ ok: true });
});

// ── Auth & User System ──────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'multichat_jwt_secret_2024_change_me';
const JWT_EXPIRES_IN = '7d';

// 简单密码验证中间件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// 用户存储辅助
function readUsers() { return readJson('users.json', []); }
function writeUsers(users) { writeJson('users.json', users); }

// 注册
app.post('/api/auth/register', async (req, res) => {
  const { username, password, nickname } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });

  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ error: '用户名已存在' });

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    username,
    nickname: nickname || username,
    password: hashedPassword,
    balance: 0, // 余额（单位：分）
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeUsers(users);

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, balance: user.balance } });
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: '用户名或密码错误' });

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, balance: user.balance } });
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ id: user.id, username: user.username, nickname: user.nickname, balance: user.balance, createdAt: user.createdAt });
});

// 更新用户信息（改昵称）
app.put('/api/auth/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.userId);
  if (idx < 0) return res.status(404).json({ error: '用户不存在' });
  if (req.body.nickname) users[idx].nickname = req.body.nickname;
  writeUsers(users);
  res.json({ id: users[idx].id, username: users[idx].username, nickname: users[idx].nickname, balance: users[idx].balance });
});

// ── ClawTip HTTP 直调模块（替代 CLI） ─────────────────────────────────
let clawtipDirect = null;
try {
  clawtipDirect = require('./clawtip-direct');
  console.log('[ClawTip] HTTP direct module loaded');
} catch (e) {
  console.warn('[ClawTip] HTTP direct module not available, falling back to CLI:', e.message);
}

// ── Balance & Recharge (ClawTip 支付集成) ──────────────────────────────
function readRecharges() { return readJson('recharges.json', []); }
function writeRecharges(r) { writeJson('recharges.json', r); }

// 查询余额
app.get('/api/balance', authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ balance: user.balance }); // 单位：分
});

// ClawTip 支付配置接口（前端需要这些信息来发起支付）
app.get('/api/clawtip/config', (req, res) => {
  res.json({
    skillSlug: CLAWTIP_SKILL_SLUG,
    indicator: getIndicator(),
    payTo: CLAWTIP_PAY_TO,
    skillVersion: CLAWTIP_SKILL_VERSION
  });
});

// 创建充值订单（生成 ClawTip 兼容的加密订单）
app.post('/api/recharge', authMiddleware, async (req, res) => {
  const { amount } = req.body || {}; // 金额，单位：元
  if (!amount || amount < 0.01) return res.status(400).json({ error: '最低充值 0.01 元' });
  if (amount > 10000) return res.status(400).json({ error: '单笔充值不能超过 10000 元' });

  const amountInCents = Math.round(amount * 100); // 转为分（ClawTip 以分为单位）
  const orderNo = 'CL' + Date.now().toString() + Math.random().toString(36).slice(2, 6);

  // ClawTip indicator = MD5(slug)
  const indicator = getIndicator();

  // SM4 加密订单数据：{orderNo, amount, payTo}
  // 金额为字符串（与 Java 示例一致）
  const orderData = JSON.stringify({
    orderNo: orderNo,
    amount: String(amountInCents),
    payTo: CLAWTIP_PAY_TO
  });
  const encryptedData = sm4Encrypt(orderData);

  // 保存充值记录
  const recharges = readRecharges();
  const record = {
    id: Date.now().toString(36),
    orderNo,
    userId: req.userId,
    amount: amountInCents, // 分
    amountYuan: amount,
    status: 'pending', // pending | success | failed
    indicator,
    encryptedData,
    payTo: CLAWTIP_PAY_TO,
    slug: CLAWTIP_SKILL_SLUG,
    description: 'AI服务充值',
    resource_url: '',
    createdAt: new Date().toISOString(),
    paidAt: null,
    credential: null
  };
  recharges.push(record);
  writeRecharges(recharges);

  // 返回订单信息（前端需要这些来发起 ClawTip 支付）
  res.status(201).json({
    orderNo,
    amount: amountInCents,
    amountYuan: amount,
    status: 'pending',
    indicator,
    encryptedData,
    payTo: CLAWTIP_PAY_TO,
    slug: CLAWTIP_SKILL_SLUG,
    description: 'AI服务充值',
    // 订单文件数据（供前端保存到本地订单文件路径）
    orderFileData: {
      'skill-id': CLAWTIP_SKILL_SLUG,
      'order_no': orderNo,
      'amount': amountInCents,
      'question': '充值 ' + amount + ' 元',
      'encrypted_data': encryptedData,
      'pay_to': CLAWTIP_PAY_TO,
      'description': 'AI服务充值',
      'slug': CLAWTIP_SKILL_SLUG,
      'resource_url': ''
    }
  });
});

// 提交支付凭证并验证充值（用户支付后提交 credential）
app.post('/api/recharge/:orderNo/verify', authMiddleware, (req, res) => {
  const { orderNo } = req.params;
  const { credential } = req.body || {};

  if (!credential) {
    return res.status(400).json({ error: '请提供支付凭证' });
  }

  const recharges = readRecharges();
  const idx = recharges.findIndex(r => r.orderNo === orderNo && r.userId === req.userId);
  if (idx < 0) return res.status(404).json({ error: '充值订单不存在' });
  if (recharges[idx].status === 'success') return res.status(400).json({ error: '该订单已充值成功' });

  // SM4 解密 credential
  try {
    const decrypted = sm4Decrypt(credential);
    console.log('[ClawTip] Credential decrypted:', decrypted);
    const credData = JSON.parse(decrypted);

    // 验证字段
    if (credData.payStatus !== 'SUCCESS') {
      return res.status(400).json({
        error: '支付未成功',
        payStatus: credData.payStatus || 'UNKNOWN',
        detail: '支付状态为 ' + (credData.payStatus || '未知') + '，请确认支付已完成'
      });
    }

    // 验证订单号和金额匹配
    if (credData.orderNo !== orderNo) {
      return res.status(400).json({ error: '订单号不匹配' });
    }
    if (credData.amount !== String(recharges[idx].amount)) {
      return res.status(400).json({ error: '金额不匹配' });
    }
    if (credData.payTo !== CLAWTIP_PAY_TO) {
      return res.status(400).json({ error: '收款地址不匹配' });
    }

    // 支付验证通过，更新状态
    recharges[idx].status = 'success';
    recharges[idx].paidAt = credData.finishTime || new Date().toISOString();
    recharges[idx].credential = credential;
    writeRecharges(recharges);

    // 增加用户余额
    const users = readUsers();
    const userIdx = users.findIndex(u => u.id === req.userId);
    if (userIdx < 0) return res.status(404).json({ error: '用户不存在' });
    users[userIdx].balance = (users[userIdx].balance || 0) + recharges[idx].amount;
    writeUsers(users);

    console.log(`[ClawTip] Recharge success: orderNo=${orderNo}, amount=${recharges[idx].amount}分, userId=${req.userId}`);

    res.json({
      ok: true,
      balance: users[userIdx].balance,
      payStatus: credData.payStatus,
      finishTime: credData.finishTime
    });
  } catch (e) {
    console.error('[ClawTip] Verify failed:', e.message);
    res.status(400).json({ error: '凭证验证失败: ' + e.message });
  }
});

// 发起 ClawTip 支付（后端调 CLI，返回授权链接给前端）
app.post('/api/recharge/:orderNo/pay', authMiddleware, async (req, res) => {
  const { orderNo } = req.params;
  const recharges = readRecharges();
  const idx = recharges.findIndex(r => r.orderNo === orderNo && r.userId === req.userId);
  if (idx < 0) return res.status(404).json({ error: '充值订单不存在' });
  // paying 状态检查：如果上次支付发起超过 3 分钟，允许重试
  if (recharges[idx].status === 'paying') {
    const payStartTime = recharges[idx].payStartedAt ? new Date(recharges[idx].payStartedAt).getTime() : 0;
    const elapsed = Date.now() - payStartTime;
    if (elapsed < 3 * 60 * 1000) {
      // 3 分钟内不重复发起，但返回当前状态让前端继续轮询
      return res.json({ type: 'already_paying', status: 'paying', orderNo });
    }
    // 超时则允许重试，继续往下走
    console.log(`[ClawTip] Retrying pay for ${orderNo}, previous attempt timed out (${Math.round(elapsed / 1000)}s ago)`);
  }

  const order = recharges[idx];

  // 更新状态为支付中，记录发起时间
  order.status = 'paying';
  order.payStartedAt = new Date().toISOString();
  writeRecharges(recharges);

  // 同时保存订单 JSON 文件到 ClawTip 指定路径（CLI 需要从文件读取）
  try {
    const indicator = order.indicator;
    const homeDir = process.env.USERPROFILE || process.env.HOME || path.join(__dirname, '..');
    const orderDir = path.join(homeDir, 'openclaw', 'skills', 'orders', indicator);
    if (!fs.existsSync(orderDir)) fs.mkdirSync(orderDir, { recursive: true });
    const orderFilePath = path.join(orderDir, `${orderNo}.json`);
    const orderFileData = {
      'skill-id': order.slug || CLAWTIP_SKILL_SLUG,
      'order_no': orderNo,
      'amount': order.amount,
      'question': '充值 ' + (order.amountYuan || (order.amount / 100).toFixed(2)) + ' 元',
      'encrypted_data': order.encryptedData,
      'pay_to': order.payTo || CLAWTIP_PAY_TO,
      'description': order.description || 'AI服务充值',
      'slug': order.slug || CLAWTIP_SKILL_SLUG,
      'resource_url': order.resource_url || ''
    };
    fs.writeFileSync(orderFilePath, JSON.stringify(orderFileData, null, 2), 'utf-8');
    console.log('[ClawTip] Order file saved to:', orderFilePath);
  } catch (e) {
    console.error('[ClawTip] Failed to save order file:', e.message);
  }

  // ── 发起支付（优先使用 HTTP 直调，回退到 CLI） ─────────────────
  try {
    let result;

    if (clawtipDirect) {
      // ★ HTTP 直调模式（无 CLI 依赖）
      console.log('[ClawTip] Using HTTP direct API call...');
      result = await clawtipDirect.initiatePayment({
        orderNo,
        amount: order.amount,
        payTo: order.payTo || CLAWTIP_PAY_TO,
        encryptedData: order.encryptedData,
        skillSlug: order.slug || CLAWTIP_SKILL_SLUG,
        skillVersion: CLAWTIP_SKILL_VERSION,
        description: order.description || 'AI服务充值',
      });
    } else {
      // 回退：CLI 模式
      console.log('[ClawTip] Using CLI fallback...');
      result = await callCliPay(orderNo, order);
    }

    console.log('[ClawTip] Payment result type:', result.type);

    if (result.type === 'need_auth' && result.authUrl) {
      return res.json({
        type: 'need_auth',
        status: 'paying',
        authUrl: result.authUrl,
        orderNo
      });
    }

    if (result.type === 'success' && result.payCredential) {
      // 有凭证，写入订单文件供 /status 轮询
      try {
        const indicator = order.indicator;
        const homeDir = process.env.USERPROFILE || process.env.HOME || path.join(__dirname, '..');
        const orderDir = path.join(homeDir, 'openclaw', 'skills', 'orders', indicator);
        if (!fs.existsSync(orderDir)) fs.mkdirSync(orderDir, { recursive: true });
        const orderFilePath = path.join(orderDir, `${orderNo}.json`);
        const existing = JSON.parse(fs.readFileSync(orderFilePath, 'utf-8'));
        existing.payCredential = result.payCredential;
        fs.writeFileSync(orderFilePath, JSON.stringify(existing, null, 2), 'utf-8');
        console.log('[ClawTip] payCredential written to order file');
      } catch (writeErr) {
        console.warn('[ClawTip] Failed to write payCredential to file:', writeErr.message);
      }

      // 尝试自动验证
      try {
        const decrypted = sm4Decrypt(result.payCredential);
        const credData = JSON.parse(decrypted);
        if (credData.payStatus === 'SUCCESS') {
          order.status = 'success';
          order.paidAt = credData.finishTime || new Date().toISOString();
          order.credential = result.payCredential;
          writeRecharges(recharges);

          const users = readUsers();
          const userIdx = users.findIndex(u => u.id === req.userId);
          if (userIdx >= 0) {
            users[userIdx].balance = (users[userIdx].balance || 0) + order.amount;
            writeUsers(users);
            console.log(`[ClawTip] Auto-recharge success: orderNo=${orderNo}, amount=${order.amount}分`);
          }

          return res.json({
            type: 'success',
            status: 'success',
            balance: userIdx >= 0 ? users[userIdx].balance : 0,
            orderNo,
            payStatus: credData.payStatus,
            finishTime: credData.finishTime
          });
        } else if (credData.payStatus === 'FAIL') {
          order.status = 'failed';
          order.paidAt = credData.finishTime || new Date().toISOString();
          writeRecharges(recharges);
          const failReason = credData.failReason || credData.message || '支付失败';
          return res.json({ type: 'error', error: failReason, status: 'failed', orderNo });
        }
      } catch (autoErr) {
        console.warn('[ClawTip] Auto-verify failed:', autoErr.message);
      }

      return res.json({ type: 'success', status: 'pending_verify', orderNo });
    }

    if (result.type === 'need_upgrade') {
      order.status = 'pending';
      writeRecharges(recharges);
      return res.status(426).json({
        type: 'need_upgrade',
        error: result.error || 'clawtip 版本需要升级',
        message: '请在 ClawTip 对话框中输入 "clawHub 升级 clawtip 到最新版本" 完成升级后重试',
        code: result.code || 'CT000035',
      });
    }

    if (result.type === 'error') {
      order.status = 'pending';
      writeRecharges(recharges);
      return res.status(400).json({ type: 'error', error: result.error || '支付发起失败' });
    }

    // 未知结果
    order.status = 'pending';
    writeRecharges(recharges);
    res.json({ type: 'unknown', raw: JSON.stringify(result).substring(0, 200), orderNo });

  } catch (e) {
    console.error('[ClawTip] Payment failed:', e.message);
    order.status = 'pending';
    writeRecharges(recharges);
    res.status(500).json({ type: 'error', error: '支付发起失败: ' + e.message });
  }
});

// 查询订单支付状态（前端轮询用）
app.get('/api/recharge/:orderNo/status', authMiddleware, (req, res) => {
  const { orderNo } = req.params;
  const recharges = readRecharges();
  const order = recharges.find(r => r.orderNo === orderNo && r.userId === req.userId);
  if (!order) return res.status(404).json({ error: '订单不存在' });

  // 如果状态是 paying，尝试从订单文件读取 payCredential（CLI 支付技能会自动写入）
  if (order.status === 'paying' || order.status === 'pending') {
    try {
      const indicator = order.indicator;
      const homeDir = process.env.USERPROFILE || process.env.HOME || path.join(__dirname, '..');
      const orderFilePath = path.join(homeDir, 'openclaw', 'skills', 'orders', indicator, `${orderNo}.json`);
      if (fs.existsSync(orderFilePath)) {
        const orderFileContent = JSON.parse(fs.readFileSync(orderFilePath, 'utf-8'));
        if (orderFileContent.payCredential) {
          console.log('[ClawTip] Found payCredential in order file, verifying...');
          try {
            const decrypted = sm4Decrypt(orderFileContent.payCredential);
            const credData = JSON.parse(decrypted);
            console.log('[ClawTip] Credential payStatus:', credData.payStatus);
            if (credData.payStatus === 'SUCCESS') {
              // 自动到账
              order.status = 'success';
              order.paidAt = credData.finishTime || new Date().toISOString();
              order.credential = orderFileContent.payCredential;
              writeRecharges(recharges);

              const users = readUsers();
              const userIdx = users.findIndex(u => u.id === req.userId);
              if (userIdx >= 0) {
                users[userIdx].balance = (users[userIdx].balance || 0) + order.amount;
                writeUsers(users);
              }
              console.log(`[ClawTip] File-poll auto-recharge: orderNo=${orderNo}`);
              return res.json({ status: 'success', balance: userIdx >= 0 ? users[userIdx].balance : 0 });
            } else if (credData.payStatus === 'FAIL') {
              // 支付失败
              order.status = 'failed';
              order.paidAt = credData.finishTime || new Date().toISOString();
              writeRecharges(recharges);
              const failReason = credData.failReason || credData.message || '支付失败';
              console.log(`[ClawTip] Payment failed: orderNo=${orderNo}, reason=${failReason}`);
              return res.json({ status: 'failed', reason: failReason, orderNo });
            }
          } catch (verifyErr) {
            console.error('[ClawTip] File credential verify failed:', verifyErr.message);
          }
        }
      }
    } catch (e) {
      // 静默失败，继续返回当前状态
    }
  }

  res.json({ status: order.status, orderNo: order.orderNo, amount: order.amount });
});

// ── CLI 回退支付函数 ──────────────────────────────────────────────────
async function callCliPay(orderNo, order) {
  const cmd = [
    'npx', '--yes', '@clawtip/clawtip-cli@1.0.1', 'pay',
    `-o${orderNo}`,
    `-i${order.indicator}`,
    `-v${CLAWTIP_SKILL_VERSION}`
  ].join(' ');

  const env = {
    ...process.env,
    CLAWTIP_SM4_KEY: CLAWTIP_SM4_KEY_BASE64,
    CLAWTIP_ENCRYPTED_DATA: order.encryptedData,
    CLAWTIP_PAY_TO: CLAWTIP_PAY_TO,
  };

  const cliResult = await new Promise((resolve) => {
    const { exec } = require('child_process');
    const child = exec(cmd, { env, timeout: 300000, encoding: 'utf-8', maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || '', stderr: stderr || '' });
    });

    let resolved = false;
    let buffer = '';
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        buffer += data;
        if (!resolved) {
          const parsed = parseClawTipResponse(buffer);
          if (parsed.type !== 'error') {
            resolved = true;
            resolve({ stdout: buffer, stderr: '' });
          }
        }
      });
    }
    setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ stdout: buffer, stderr: '' }); }
    }, 15000);
  });

  const stdout = cliResult.stdout || cliResult.stderr || '';
  if (!stdout || !stdout.trim()) {
    throw new Error('CLI 无输出');
  }

  const parsed = parseClawTipResponse(stdout || '');
  return parsed;
}

// ClawTip CLI 响应解析
function parseClawTipResponse(raw) {
  // 过滤 Windows PowerShell CLIXML 噪音（#< CLIXML ... </Objs>）
  let trimmed = (raw || '')
    .replace(/#<\s*CLIXML[\s\S]*?<\/Objs>\s*/g, '')
    .trim();

  // 如果过滤后为空，返回错误
  if (!trimmed) return { type: 'error', error: 'CLI 无输出' };

  // 尝试 JSON 解析
  try {
    const json = JSON.parse(trimmed);
    if (json.payCredential || json.credential || json.type === 'success' || json.status === 'paid') {
      return { type: 'success', payCredential: json.payCredential || json.credential };
    }
    if (json.authUrl || json.url || json.type === 'need_auth') {
      return { type: 'need_auth', authUrl: json.authUrl || json.url };
    }
    if (json.error || json.type === 'error') {
      return { type: 'error', error: json.error || json.message || '未知错误' };
    }
  } catch {}

  // 尝试提取 JSON 片段
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0]);
      if (json.payCredential || json.credential) return { type: 'success', payCredential: json.payCredential || json.credential };
      if (json.authUrl || json.url) return { type: 'need_auth', authUrl: json.authUrl || json.url };
      if (json.error) return { type: 'error', error: json.error };
    } catch {}
  }

  // 提取授权 URL
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
  if (urlMatch) return { type: 'need_auth', authUrl: urlMatch[0] };

  // 提取 payCredential
  const credMatch = trimmed.match(/payCredential[=:\s]*["']?([^"'\s,}]+)/);
  if (credMatch) return { type: 'success', payCredential: credMatch[1] };

  return { type: 'error', error: trimmed.substring(0, 200) || '无法解析响应' };
}

// 保留旧的 confirm 接口（兼容性，标记为废弃）
app.post('/api/recharge/:orderNo/confirm', authMiddleware, (req, res) => {
  res.status(410).json({ error: '此接口已废弃，请使用 /api/recharge/:orderNo/verify 并提交支付凭证' });
});

// 获取充值记录
app.get('/api/recharge/history', authMiddleware, (req, res) => {
  const recharges = readRecharges()
    .filter(r => r.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50)
    .map(r => ({ orderNo: r.orderNo, amount: r.amount, status: r.status, createdAt: r.createdAt, paidAt: r.paidAt }));
  res.json(recharges);
});

// ── Serve frontend static files ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// ── Health check (for Docker / load balancer) ────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Multi-model chat server running on http://localhost:${PORT}`);
});
