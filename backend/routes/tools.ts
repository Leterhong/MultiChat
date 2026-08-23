'use strict';

// MultiChat's built-in functions are tools, not Agent Skills. Keeping this
// endpoint separate avoids conflating executable capabilities with SKILL.md.
const ctx = require('../lib/context');
const agent = require('../runtime/agent');

function listTools() {
  return ctx.store.read(ctx.SKILL_FILE, [])
    .filter(item => !['prompt', 'mcp'].includes(item.type))
    .map(item => ({ ...agent.publicSkill(item), kind: 'builtin-tool' }));
}

module.exports = function registerTools(app) {
  app.get('/api/tools', (req, res) => res.json(listTools()));
  app.put('/api/tools/:id', (req, res) => {
    const rows = ctx.store.read(ctx.SKILL_FILE, []);
    const index = rows.findIndex(item => item.id === req.params.id && !['prompt', 'mcp'].includes(item.type));
    if (index < 0) return res.status(404).json({ error: 'tool not found', code: 'NOT_FOUND' });
    rows[index].enabled = req.body?.enabled !== false;
    ctx.store.write(ctx.SKILL_FILE, rows);
    res.json(agent.publicSkill(rows[index]));
  });
};
