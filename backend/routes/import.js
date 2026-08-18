'use strict';
// ── Import（文件上传 / URL 导入：外部技能或智能体并入本地，或安装为插件） ──
const ctx = require('../lib/context');
const pm = require('../plugins/manager');
const { fail } = require('../lib/errors');

// 将 incoming 合并进 current 数组（就地修改，由调用方在并发锁内传入），
// 已存在 id 则覆盖、否则新增，返回新增数量。不自行读写文件，便于 store.mutate 串行化。
function mergeImport(current, incoming, idPrefix, tag) {
  let added = 0;
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    if (!raw.id) raw.id = idPrefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (!raw.name) raw.name = raw.id;
    raw._import = tag || 'import';
    const idx = current.findIndex(x => x.id === raw.id);
    if (idx >= 0) current[idx] = Object.assign({}, current[idx], raw);
    else { current.push(raw); added++; }
  }
  return added;
}

module.exports = function registerImport(app) {
  app.post('/api/import', async (req, res) => {
    const body = req.body || {};
    const tag = (body.source && String(body.source)) || 'import';
    try {
      let json = body;
      if (typeof body.payload === 'string') {
        if (body.payload.length > 2_000_000) return fail(res, 413, 'IMPORT_FAILED', '导入文件过大，限制为 2 MB');
        try { json = JSON.parse(body.payload); }
        catch { return fail(res, 400, 'INVALID_PACKAGE', 'payload 不是合法 JSON'); }
      }
      // ── URL 导入：由后端抓取，规避浏览器 CORS ──
      if (body.url) {
        let u = String(body.url).trim();
        // 同源相对路径（如 /marketplace/skills.json）按请求 host 补全为绝对 URL
        let sameOrigin = false;
        if (u.startsWith('/')) { u = 'http://' + (req.headers.host || ('127.0.0.1:' + ctx.PORT)) + u; sameOrigin = true; }
        if (!/^https?:\/\//i.test(u)) return fail(res, 400, 'BAD_REQUEST', '仅支持 http/https 链接');
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        let fetched;
        try {
          // 同源（本应用市场）允许访问本机；外部 URL 严格拦截内网地址（SSRF）
          const resp = await ctx.safeFetch(u, { signal: ctrl.signal, headers: { accept: 'application/json' } }, sameOrigin);
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const contentType = resp.headers.get('content-type') || '';
          if (!/application\/json/i.test(contentType)) throw new Error('响应不是 JSON（' + contentType + '）');
          const text = await resp.text();
          if (text.length > 2_000_000) throw new Error('响应超过 2 MB 限制');
          fetched = JSON.parse(text);
        } catch (e) {
          clearTimeout(timer);
          return fail(res, 502, 'IMPORT_FAILED', '抓取失败：' + e.message);
        } finally { clearTimeout(timer); }
        json = fetched;
      }
      // ── 插件清单：含 id 且 type 为 mcp|bundle ──
      if (json && json.id && ['mcp', 'bundle'].includes(json.type)) {
        let r;
        await ctx.store.mutate('_plugin_ops', () => { r = pm.importPluginFromUrlManifest(json, { remote: !!body.url }); });
        return res.json({ ok: true, plugin: r, skills: r.skills, agents: r.agents });
      }
      // ── 技能 / 智能体包（在并发锁内合并，避免多请求同时写覆盖） ──
      const skillsIn = Array.isArray(json) ? json : (json.skills || []);
      const agentsIn = Array.isArray(json) ? [] : (json.agents || []);
      if (!Array.isArray(skillsIn) || !Array.isArray(agentsIn)) {
        return fail(res, 400, 'INVALID_PACKAGE', 'skills/agents must be arrays');
      }
      let skillsAdded = 0, agentsAdded = 0;
      await ctx.store.mutate(ctx.SKILL_FILE, (cur) => { skillsAdded = mergeImport(cur, skillsIn, 'sk', tag); return cur; }, []);
      await ctx.store.mutate(ctx.AGENT_FILE, (cur) => { agentsAdded = mergeImport(cur, agentsIn, 'ag', tag); return cur; }, []);
      res.json({ ok: true, skills: skillsAdded, agents: agentsAdded });
    } catch (e) {
      // 插件清单校验类错误由 AppError 抛出，统一转为结构化失败响应
      if (e.code) return fail(res, e.statusCode || 500, e.code, e.message);
      fail(res, 500, 'INTERNAL', e.message);
    }
  });
};
