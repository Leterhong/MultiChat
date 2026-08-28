'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── Meta：runtime / catalog / health（信息聚合端点） ─────────────────────
const ctx = require('../lib/context');
const extensions = require('../extensions/manager');
const { assetMeta } = require('../lib/util');
module.exports = function registerMeta(app) {
    app.get('/api/runtime', (req, res) => {
        const providers = ctx.providerStore.list();
        const skills = extensions.listSkills();
        const agents = ctx.store.read(ctx.AGENT_FILE, []);
        const plugins = extensions.listPlugins();
        const mcpServers = extensions.listMcpServers();
        res.json({
            name: 'MultiChat Agent Workspace',
            version: ctx.VERSION,
            node: process.version,
            mode: process.env.NODE_ENV || 'development',
            capabilities: ['chat', 'streaming', 'agents', 'agent-skills', 'plugins', 'mcp-discovery', 'codex-sync', 'git-diff', 'run-history', 'usage-ledger', 'context-lens', 'capability-passports', 'project-memory', 'project-snapshots'],
            counts: { providers: providers.length, models: providers.reduce((n, p) => n + (p.models || []).length, 0), skills: skills.length, agents: agents.length, plugins: plugins.length, mcpServers: mcpServers.length, runs: ctx.store.read(ctx.RUN_FILE, []).length, workspaces: ctx.workspaceStore.workspaces().length, projects: ctx.workspaceStore.projects().length, assets: ctx.workspaceStore.assets().length },
            adapters: Object.keys(ctx.ADAPTER_MAP),
        });
    });
    app.get('/api/catalog', (req, res) => {
        const providers = ctx.providerStore.list();
        const skills = extensions.listSkills();
        const tools = ctx.store.read(ctx.SKILL_FILE, []).filter(item => !['prompt', 'mcp'].includes(item.type));
        const agents = ctx.store.read(ctx.AGENT_FILE, []);
        const plugins = extensions.listPlugins();
        const mcpServers = extensions.listMcpServers();
        res.json({ providers: providers.map(ctx.providerStore.publicRecord), skills, tools, agents, plugins, mcpServers, workspaces: ctx.workspaceStore.workspaces(), projects: ctx.workspaceStore.projects(), assets: ctx.workspaceStore.assets().map(assetMeta) });
    });
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', version: ctx.VERSION, uptime: process.uptime(), storage: ctx.store.kind || 'json', skills: extensions.listSkills().length, mcpServers: extensions.listMcpServers().length, agents: ctx.store.read(ctx.AGENT_FILE, []).length });
    });
};
//# sourceMappingURL=meta.js.map