'use strict';
// ── Provider / Models 路由 ──────────────────────────────────────────────
// GET 接口返回脱敏后的 provider（apiKey 不出现在响应体中）。
const ctx = require('../lib/context');

// 返回给前端的 provider 不含明文 apiKey，仅保留 masked 标志与末尾预览，避免密钥泄露。
function publicProvider(p) {
  if (!p) return p;
  const { apiKey, ...rest } = p;
  if (!apiKey) return rest;
  const preview = apiKey.length > 4 ? apiKey.slice(-4) : apiKey;
  return { ...rest, apiKeyMasked: true, apiKeyPreview: preview };
}

module.exports = function registerProviders(app) {
  app.get('/api/providers', (req, res) => {
    res.json(ctx.store.read('providers.json', []).map(publicProvider));
  });
  app.post('/api/providers', (req, res) => {
    const provider = { id: Date.now().toString(36), ...req.body };
    const providers = ctx.store.read('providers.json', []);
    providers.push(provider);
    ctx.store.write('providers.json', providers);
    res.json(publicProvider(provider));
  });
  app.put('/api/providers/:id', (req, res) => {
    const providers = ctx.store.read('providers.json', []);
    const idx = providers.findIndex(p => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'not found' });
    const body = req.body || {};
    const prev = providers[idx];
    // 未提供新密钥（或回传 masked 占位）时保留原 apiKey，避免被掩码覆盖
    let apiKey = prev.apiKey;
    if (body.apiKey && !body.apiKeyMasked && body.apiKey !== '••••••••') apiKey = body.apiKey;
    const updated = { ...prev, ...body, id: req.params.id, apiKey };
    delete updated.apiKeyMasked;
    delete updated.apiKeyPreview;
    providers[idx] = updated;
    ctx.store.write('providers.json', providers);
    res.json(publicProvider(updated));
  });
  app.delete('/api/providers/:id', (req, res) => {
    let providers = ctx.store.read('providers.json', []);
    providers = providers.filter(p => p.id !== req.params.id);
    ctx.store.write('providers.json', providers);
    res.json({ ok: true });
  });

  // ── Models: list all models grouped by provider ──
  app.get('/api/models', (req, res) => {
    const providers = ctx.store.read('providers.json', []);
    const models = [];
    for (const p of providers) {
      (p.models || []).forEach(m => {
        models.push({ id: `${p.id}:${m}`, name: m, providerId: p.id, providerName: p.name });
      });
    }
    res.json(models);
  });

  // ── Local model discovery (Ollama / LM Studio) ──
  app.post('/api/fetch-local-models', async (req, res) => {
    const { apiType, baseUrl } = req.body || {};
    if (!apiType || !baseUrl) {
      return res.status(400).json({ error: 'apiType and baseUrl are required' });
    }
    try {
      if (apiType === 'ollama') {
        const url = `${baseUrl.replace(/\/+$/, '')}/api/tags`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return res.status(resp.status).json({ error: `Ollama returned HTTP ${resp.status}` });
        const data = await resp.json();
        const models = (data.models || []).map(m => m.name || m.model).filter(Boolean);
        return res.json({ models });
      }
      if (apiType === 'lmstudio') {
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
};
