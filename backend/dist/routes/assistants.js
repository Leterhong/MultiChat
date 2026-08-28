'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── Assistants CRUD（遗留，保留兼容） ──────────────────────────────────
const ctx = require('../lib/context');
module.exports = function registerAssistants(app) {
    app.get('/api/assistants', (req, res) => {
        res.json(ctx.store.read('assistants.json', []));
    });
    app.post('/api/assistants', (req, res) => {
        const assistants = ctx.store.read('assistants.json', []);
        const assistant = { id: Date.now().toString(36), ...req.body };
        assistants.push(assistant);
        ctx.store.write('assistants.json', assistants);
        res.json(assistant);
    });
    app.put('/api/assistants/:id', (req, res) => {
        const assistants = ctx.store.read('assistants.json', []);
        const idx = assistants.findIndex(a => a.id === req.params.id);
        if (idx < 0)
            return res.status(404).json({ error: 'not found' });
        assistants[idx] = { ...assistants[idx], ...req.body, id: req.params.id };
        ctx.store.write('assistants.json', assistants);
        res.json(assistants[idx]);
    });
    app.delete('/api/assistants/:id', (req, res) => {
        let assistants = ctx.store.read('assistants.json', []);
        assistants = assistants.filter(a => a.id !== req.params.id);
        ctx.store.write('assistants.json', assistants);
        res.json({ ok: true });
    });
};
//# sourceMappingURL=assistants.js.map