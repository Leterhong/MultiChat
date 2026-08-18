'use strict';
// ── Skills CRUD + 执行 ─────────────────────────────────────────────────
const ctx = require('../lib/context');
const agent = require('../runtime/agent');

module.exports = function registerSkills(app) {
  app.get('/api/skills', (req, res) => res.json(ctx.store.read(ctx.SKILL_FILE, []).map(agent.publicSkill)));
  app.get('/api/skills/:id', (req, res) => {
    const skill = ctx.store.read(ctx.SKILL_FILE, []).find(x => x.id === req.params.id);
    if (!skill) return res.status(404).json({ error: 'not found' });
    res.json(agent.publicSkill(skill));
  });
  app.post('/api/skills', (req, res) => {
    const skills = ctx.store.read(ctx.SKILL_FILE, []);
    const skill = { id: 'sk_' + Date.now().toString(36), enabled: true, config: {}, ...req.body };
    skills.push(skill);
    ctx.store.write(ctx.SKILL_FILE, skills);
    res.json(skill);
  });
  app.put('/api/skills/:id', (req, res) => {
    const skills = ctx.store.read(ctx.SKILL_FILE, []);
    const idx = skills.findIndex(s => s.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'not found' });
    skills[idx] = { ...skills[idx], ...req.body, id: req.params.id };
    ctx.store.write(ctx.SKILL_FILE, skills);
    res.json(agent.publicSkill(skills[idx]));
  });
  app.delete('/api/skills/:id', (req, res) => {
    let skills = ctx.store.read(ctx.SKILL_FILE, []);
    skills = skills.filter(s => s.id !== req.params.id);
    ctx.store.write(ctx.SKILL_FILE, skills);
    // 也清掉所有 agent 的引用
    const agents = ctx.store.read(ctx.AGENT_FILE, []);
    let touched = false;
    for (const a of agents) {
      if (a.skillIds && a.skillIds.includes(req.params.id)) {
        a.skillIds = a.skillIds.filter(x => x !== req.params.id);
        touched = true;
      }
    }
    if (touched) ctx.store.write(ctx.AGENT_FILE, agents);
    res.json({ ok: true });
  });
  app.post('/api/skills/:id/execute', async (req, res) => {
    const skills = ctx.store.read(ctx.SKILL_FILE, []);
    const s = skills.find(x => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const policy = req.body?.policy || 'auto';
    if (!agent.isSkillAllowed(s, policy)) return res.status(403).json({ ok: false, error: 'permission denied by safe policy', policy, permissions: agent.skillPermissions(s) });
    const result = await agent.executeSkill(s, (req.body && req.body.params) || {});
    res.json(result);
  });
};
