'use strict';
// ── Agents CRUD ────────────────────────────────────────────────────────
// 注：/api/agents/:id/chat（流式工具循环）位于 routes/chat.js，
// 与 /v1/chat/completions 共用 adapters 与 agent runtime，便于统一维护。
const ctx = require('../lib/context');

function normalizeCapabilityRefs(agent, migrateLegacyTools = true) {
  const builtinToolIds = new Set(ctx.store.read(ctx.SKILL_FILE, [])
    .filter(item => !['prompt', 'mcp'].includes(item.type))
    .map(item => item.id));
  const legacyIds = Array.isArray(agent.skillIds) ? agent.skillIds.map(String) : [];
  const explicitTools = Array.isArray(agent.toolIds) ? agent.toolIds.map(String) : [];
  const legacyTools = migrateLegacyTools ? legacyIds.filter(id => builtinToolIds.has(id)) : [];
  agent.toolIds = [...new Set([...explicitTools, ...legacyTools])];
  agent.skillIds = legacyIds.filter(id => !builtinToolIds.has(id));
  agent.skillRefs = Array.isArray(agent.skillRefs) ? agent.skillRefs.map(String) : [];
  agent.mcpServerIds = Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds.map(String) : [];
  return agent;
}

module.exports = function registerAgents(app) {
  app.get('/api/agents', (req, res) => res.json(ctx.store.read(ctx.AGENT_FILE, [])));
  app.get('/api/agents/:id', (req, res) => {
    const agent = ctx.store.read(ctx.AGENT_FILE, []).find(x => x.id === req.params.id);
    if (!agent) return res.status(404).json({ error: 'not found' });
    res.json(agent);
  });
  app.post('/api/agents', (req, res) => {
    const agents = ctx.store.read(ctx.AGENT_FILE, []);
    const agent = normalizeCapabilityRefs(
      { id: 'ag_' + Date.now().toString(36), skillIds: [], skillRefs: [], toolIds: [], mcpServerIds: [], systemPrompt: '', createdAt: new Date().toISOString(), ...req.body },
      !Array.isArray(req.body?.toolIds),
    );
    agents.push(agent);
    ctx.store.write(ctx.AGENT_FILE, agents);
    res.json(agent);
  });
  app.put('/api/agents/:id', (req, res) => {
    const agents = ctx.store.read(ctx.AGENT_FILE, []);
    const idx = agents.findIndex(a => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'not found' });
    agents[idx] = normalizeCapabilityRefs(
      { ...agents[idx], ...req.body, id: req.params.id },
      !Array.isArray(req.body?.toolIds),
    );
    ctx.store.write(ctx.AGENT_FILE, agents);
    res.json(agents[idx]);
  });
  app.delete('/api/agents/:id', (req, res) => {
    let agents = ctx.store.read(ctx.AGENT_FILE, []);
    agents = agents.filter(a => a.id !== req.params.id);
    ctx.store.write(ctx.AGENT_FILE, agents);
    res.json({ ok: true });
  });
};
