'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
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
        if (index < 0)
            return res.status(404).json({ error: 'tool not found', code: 'NOT_FOUND' });
        rows[index].enabled = req.body?.enabled !== false;
        ctx.store.write(ctx.SKILL_FILE, rows);
        res.json(agent.publicSkill(rows[index]));
    });
    // ── 本地试跑：只开放无网络、无副作用的纯计算类工具，避免端点被当作代理 ──
    const TESTABLE_TYPES = new Set(['datetime', 'calculator']);
    app.post('/api/tools/:id/test', (req, res, next) => {
        void (async () => {
            const tool = listTools().find(item => item.id === req.params.id);
            if (!tool)
                return res.status(404).json({ error: 'tool not found', code: 'NOT_FOUND' });
            if (!TESTABLE_TYPES.has(tool.type)) {
                return res.status(400).json({ error: `「${tool.name}」暂不支持界面试跑（涉及网络访问，请通过对话调用）`, code: 'NOT_TESTABLE' });
            }
            const args = tool.type === 'calculator'
                ? { expression: String(req.body?.expression ?? '').trim() }
                : {};
            const started = Date.now();
            const result = await agent.executeSkill(tool, args);
            res.json({ ...result, elapsedMs: Date.now() - started });
        })().catch(next);
    });
};
//# sourceMappingURL=tools.js.map