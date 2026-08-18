'use strict';
// ── Plugins：本地插件市场 + MCP 连接器（安装 / 卸载 / 启停） ──────────────
const ctx = require('../lib/context');
const pm = require('../plugins/manager');
const { fail } = require('../lib/errors');

module.exports = function registerPlugins(app) {
  app.get('/api/plugins', (req, res) => {
    const state = pm.pluginState();
    const list = pm.listPluginManifests().map(({ manifest }) => ({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      author: manifest.author,
      type: manifest.type,
      description: manifest.description,
      skillCount: (manifest.skills || []).length,
      agentCount: (manifest.agents || []).length,
      installed: !!(state[manifest.id] && state[manifest.id].installed),
      enabled: !!(state[manifest.id] && state[manifest.id].enabled),
    }));
    res.json(list);
  });

  app.post('/api/plugins/:id/install', async (req, res) => {
    const found = pm.listPluginManifests().find(x => x.manifest.id === req.params.id);
    if (!found) return fail(res, 404, 'PLUGIN_NOT_FOUND', 'plugin not found');
    try {
      let r;
      await ctx.store.mutate('_plugin_ops', () => { r = pm.installPlugin(ctx.normalizePackage(found.manifest), found.dir); });
      res.json({ ok: true, ...r });
    } catch (e) { fail(res, 500, 'INTERNAL', e.message); }
  });

  app.post('/api/plugins/:id/uninstall', async (req, res) => {
    const found = pm.listPluginManifests().find(x => x.manifest.id === req.params.id);
    if (!found) return fail(res, 404, 'PLUGIN_NOT_FOUND', 'plugin not found');
    try {
      let r;
      await ctx.store.mutate('_plugin_ops', () => { r = pm.uninstallPlugin(found.manifest); });
      res.json(r);
    } catch (e) { fail(res, 500, 'INTERNAL', e.message); }
  });

  app.post('/api/plugins/:id/toggle', async (req, res) => {
    const found = pm.listPluginManifests().find(x => x.manifest.id === req.params.id);
    if (!found) return fail(res, 404, 'PLUGIN_NOT_FOUND', 'plugin not found');
    const enabled = req.body && req.body.enabled !== false;
    try {
      let r;
      await ctx.store.mutate('_plugin_ops', () => { r = pm.setPluginEnabled(found.manifest, enabled); });
      res.json(r);
    } catch (e) { fail(res, 500, 'INTERNAL', e.message); }
  });
};
