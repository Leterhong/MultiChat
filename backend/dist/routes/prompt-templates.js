'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── 提示词模板库：运行配置系统指令的可复用命名模板（纯文本，无执行语义）──
const ctx = require('../lib/context');
function normalize(raw) {
    if (!raw || typeof raw !== 'object')
        throw new Error('template must be an object');
    const name = String(raw.name || '').trim();
    const content = String(raw.content || '').replace(/\r\n/g, '\n').trim();
    if (!name || name.length > 80)
        throw new Error('模板名称必须是 1-80 个字符');
    if (!content || content.length > 30_000)
        throw new Error('模板内容必须是 1-30000 个字符');
    return { id: ctx.safeId(raw.id || 'pt_' + Date.now().toString(36), 'template id'), name, content, createdAt: raw.createdAt || new Date().toISOString() };
}
module.exports = function registerPromptTemplates(app) {
    app.get('/api/prompt-templates', (req, res) => res.json(ctx.store.read('prompt_templates.json', [])));
    app.post('/api/prompt-templates', (req, res) => {
        let tpl;
        try {
            tpl = normalize(req.body);
        }
        catch (e) {
            return res.status(400).json({ error: e.message, code: 'INVALID_TEMPLATE' });
        }
        ctx.store.mutate('prompt_templates.json', rows => {
            const i = rows.findIndex(r => r.name === tpl.name);
            if (i >= 0)
                rows[i] = tpl;
            else
                rows.push(tpl);
            return rows;
        }, []);
        res.status(201).json(tpl);
    });
    app.delete('/api/prompt-templates/:id', (req, res) => {
        ctx.store.mutate('prompt_templates.json', rows => rows.filter(r => r.id !== req.params.id), []);
        res.json({ ok: true });
    });
};
//# sourceMappingURL=prompt-templates.js.map