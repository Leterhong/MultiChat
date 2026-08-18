'use strict';
// ── Meta：runtime / catalog / health（信息聚合端点） ─────────────────────
const ctx = require('../lib/context');
const pm = require('../plugins/manager');
const { assetMeta } = require('../lib/util');

module.exports = function registerMeta(app) {
  app.get('/api/runtime', (req, res) => {
    const providers = ctx.store.read('providers.json', []);
    const skills = ctx.store.read(ctx.SKILL_FILE, []);
    const agents = ctx.store.read(ctx.AGENT_FILE, []);
    const plugins = pm.listPluginManifests();
    res.json({
      name: 'MultiChat Agent Workspace',
      version: ctx.VERSION,
      node: process.version,
      mode: process.env.NODE_ENV || 'development',
      capabilities: ['chat', 'streaming', 'agents', 'skills', 'plugins', 'mcp', 'local-import', 'url-import', 'run-history'],
      counts: { providers: providers.length, models: providers.reduce((n, p) => n + (p.models || []).length, 0), skills: skills.length, agents: agents.length, plugins: plugins.length, runs: ctx.store.read(ctx.RUN_FILE, []).length, workspaces: ctx.workspaceStore.workspaces().length, projects: ctx.workspaceStore.projects().length, assets: ctx.workspaceStore.assets().length },
      adapters: Object.keys(ctx.ADAPTER_MAP),
    });
  });

  app.get('/api/catalog', (req, res) => {
    const providers = ctx.store.read('providers.json', []);
    const skills = ctx.store.read(ctx.SKILL_FILE, []);
    const agents = ctx.store.read(ctx.AGENT_FILE, []);
    const plugins = pm.listPluginManifests().map(({ manifest }) => manifest);
    res.json({ providers, skills, agents, plugins, workspaces: ctx.workspaceStore.workspaces(), projects: ctx.workspaceStore.projects(), assets: ctx.workspaceStore.assets().map(assetMeta) });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: ctx.VERSION, uptime: process.uptime(), skills: ctx.store.read(ctx.SKILL_FILE, []).length, agents: ctx.store.read(ctx.AGENT_FILE, []).length });
  });
};
