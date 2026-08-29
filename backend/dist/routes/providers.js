'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── Provider / Models 路由 ──────────────────────────────────────────────
// GET 接口返回脱敏后的 provider（apiKey 不出现在响应体中）。
const ctx = require('../lib/context');
const { readResponseJson, readResponseText } = require('../lib/util');
const { redactSecrets } = require('../lib/redact');
function normalizeProvider(input, previous = null) {
    const id = previous?.id || ctx.safeId(input.id || Date.now().toString(36), 'provider id');
    const apiType = String(input.apiType ?? previous?.apiType ?? 'openai').trim().toLowerCase();
    if (!ctx.ADAPTER_MAP[apiType])
        throw new Error('unsupported provider apiType');
    const baseUrl = String(input.baseUrl ?? previous?.baseUrl ?? '').trim().replace(/\/+$/, '');
    if (!baseUrl || baseUrl.length > 2048)
        throw new Error('baseUrl is required');
    let parsed;
    try {
        parsed = new URL(baseUrl);
    }
    catch {
        throw new Error('baseUrl must be a valid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('baseUrl must be an http(s) URL without embedded credentials');
    }
    if ([...parsed.searchParams.keys()].some(key => /(?:api[-_]?key|access[-_]?token|token|secret|password|authorization|credential)/i.test(key))) {
        throw new Error('baseUrl must not contain credential query parameters');
    }
    const modelInput = input.models ?? previous?.models;
    const models = Array.isArray(modelInput)
        ? [...new Set(modelInput.map(value => String(value).trim()).filter(Boolean))].slice(0, 200)
        : [];
    if (models.some(model => model.length > 200))
        throw new Error('model name is too long');
    return {
        id,
        name: String(input.name ?? previous?.name ?? id).trim().slice(0, 120) || id,
        apiType,
        baseUrl,
        apiKey: input.apiKey !== undefined ? String(input.apiKey || '') : String(previous?.apiKey || ''),
        models,
        allowPrivate: input.allowPrivate !== undefined
            ? input.allowPrivate === true
            : (previous?.allowPrivate === true || ['ollama', 'lmstudio'].includes(apiType)),
        updatedAt: new Date().toISOString(),
        createdAt: previous?.createdAt || new Date().toISOString(),
    };
}
module.exports = function registerProviders(app) {
    app.get('/api/providers', (req, res) => {
        res.json(ctx.providerStore.publicList());
    });
    app.post('/api/providers', (req, res) => {
        let provider;
        try {
            provider = normalizeProvider(req.body || {});
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
        const providers = ctx.providerStore.list();
        if (providers.some(item => item.id === provider.id))
            return res.status(409).json({ error: 'provider id already exists' });
        providers.push(provider);
        ctx.providerStore.save(providers);
        res.json(ctx.providerStore.publicRecord(provider));
    });
    app.put('/api/providers/:id', (req, res) => {
        const providers = ctx.providerStore.list();
        const idx = providers.findIndex(p => p.id === req.params.id);
        if (idx < 0)
            return res.status(404).json({ error: 'not found' });
        const body = req.body || {};
        const prev = providers[idx];
        // 未提供新密钥（或回传 masked 占位）时保留原 apiKey，避免被掩码覆盖
        let apiKey = prev.apiKey;
        if (body.apiKey && !body.apiKeyMasked && body.apiKey !== '••••••••')
            apiKey = body.apiKey;
        let updated;
        try {
            updated = normalizeProvider({ ...body, apiKey }, prev);
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
        providers[idx] = updated;
        ctx.providerStore.save(providers);
        res.json(ctx.providerStore.publicRecord(updated));
    });
    app.delete('/api/providers/:id', (req, res) => {
        let providers = ctx.providerStore.list();
        providers = providers.filter(p => p.id !== req.params.id);
        ctx.providerStore.save(providers);
        res.json({ ok: true });
    });
    // ── Models: list all models grouped by provider ──
    app.get('/api/models', (req, res) => {
        const providers = ctx.providerStore.list();
        const models = [];
        for (const p of providers) {
            (p.models || []).forEach(m => {
                models.push({ id: `${p.id}:${m}`, name: m, providerId: p.id, providerName: p.name });
            });
        }
        res.json(models);
    });
    // ── 连接测试：用服务端保存的密钥探测 OpenAI 兼容的 GET /models，返回可达性与模型清单 ──
    app.post('/api/providers/:id/probe', async (req, res) => {
        const providers = ctx.providerStore.list();
        const provider = providers.find(p => p.id === req.params.id);
        if (!provider)
            return res.status(404).json({ error: 'provider not found', code: 'NOT_FOUND' });
        const baseUrl = String(provider.baseUrl || '').replace(/\/+$/, '');
        let parsed;
        try {
            parsed = new URL(baseUrl);
        }
        catch {
            return res.status(400).json({ error: 'provider baseUrl 无效' });
        }
        const modelsUrl = `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}/models`;
        const headers = { accept: 'application/json' };
        if (provider.apiKey)
            headers.authorization = `Bearer ${provider.apiKey}`;
        try {
            const resp = await ctx.safeFetch(modelsUrl, { headers, signal: AbortSignal.timeout(8000) }, provider.allowPrivate === true);
            if (!resp.ok) {
                const detail = await readResponseText(resp).catch(() => '');
                const brief = redactSecrets(String(detail || '').slice(0, 200));
                return res.status(resp.status).json({ ok: false, error: `HTTP ${resp.status}${brief ? `：${brief}` : ''}` });
            }
            const data = await readResponseJson(resp, 2_000_000);
            const raw = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
            const models = raw.map((m) => String(m?.id || m?.name || '')).filter(Boolean);
            const capabilities = {
                vision: models.some(m => /(?:vision|vl|omni|multimodal|4o|gpt-4-turbo|gemini|claude-[35])/i.test(m)),
                reasoning: models.some(m => /(?:reason|think|o[1345]-|r1|qwq)/i.test(m)),
            };
            res.json({ ok: true, models, capabilities, modelCount: models.length });
        }
        catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            const causeCode = error?.cause?.code || '';
            const timedOut = /timeout|abort/i.test(raw);
            const friendly = timedOut ? '连接超时（8s）——请确认 baseUrl 可达'
                : /fetch failed/i.test(raw) ? `无法连接到 ${parsed.host}${causeCode ? `（${causeCode}）` : ''}`
                    : redactSecrets(raw);
            res.status(502).json({ ok: false, error: friendly });
        }
    });
    // ── Local model discovery (Ollama / LM Studio) ──
    app.post('/api/fetch-local-models', async (req, res) => {
        const { apiType, baseUrl } = req.body || {};
        if (!apiType || !baseUrl) {
            return res.status(400).json({ error: 'apiType and baseUrl are required' });
        }
        try {
            let parsed;
            try {
                parsed = new URL(baseUrl);
            }
            catch {
                return res.status(400).json({ error: 'baseUrl must be a valid URL' });
            }
            const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
            if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !['localhost', '127.0.0.1', '::1'].includes(hostname)) {
                return res.status(400).json({ error: 'local model discovery only accepts loopback addresses' });
            }
            if (!['ollama', 'lmstudio'].includes(String(apiType).toLowerCase())) {
                return res.status(400).json({ error: `Unsupported apiType for local discovery: ${apiType}` });
            }
            if (apiType === 'ollama') {
                const url = new URL('/api/tags', parsed.origin).toString();
                const resp = await ctx.safeFetch(url, { signal: AbortSignal.timeout(5000) }, true);
                if (!resp.ok)
                    return res.status(resp.status).json({ error: `Ollama returned HTTP ${resp.status}` });
                const data = await readResponseJson(resp, 2_000_000);
                const models = (data.models || []).map(m => m.name || m.model).filter(Boolean);
                return res.json({ models });
            }
            if (apiType === 'lmstudio') {
                const base = `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
                const url = `${base}${/\/v1$/i.test(base) ? '' : '/v1'}/models`;
                const resp = await ctx.safeFetch(url, { signal: AbortSignal.timeout(5000) }, true);
                if (!resp.ok)
                    return res.status(resp.status).json({ error: `LM Studio returned HTTP ${resp.status}` });
                const data = await readResponseJson(resp, 2_000_000);
                const models = (data.data || []).map(m => m.id).filter(Boolean);
                return res.json({ models });
            }
        }
        catch (e) {
            res.status(502).json({ error: `Cannot connect to the local model service: ${redactSecrets(e.message)}` });
        }
    });
};
//# sourceMappingURL=providers.js.map