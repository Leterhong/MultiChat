'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── Conversations CRUD ──────────────────────────────────────────────────
const ctx = require('../lib/context');
// 消息文件名由 id 拼接而成（messages_<id>.json）。id 必须先过白名单，
// 否则带路径分隔符的 id 会落到 store 的 basename 校验上变成 500 + 内部报错泄漏。
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
function assertSafeId(res, id) {
    if (typeof id === 'string' && SAFE_ID_RE.test(id))
        return true;
    res.status(400).json({ error: 'invalid conversation id', code: 'INVALID_ID' });
    return false;
}
module.exports = function registerConversations(app) {
    app.get('/api/conversations', (req, res) => {
        res.json(ctx.store.read('conversations.json', []));
    });
    app.get('/api/conversations/:id', (req, res) => {
        if (!assertSafeId(res, req.params.id))
            return;
        const convs = ctx.store.read('conversations.json', []);
        const conv = convs.find(c => c.id === req.params.id);
        if (!conv)
            return res.status(404).json({ error: 'not found' });
        const messages = ctx.store.read(`messages_${req.params.id}.json`, []);
        res.json({ ...conv, messages });
    });
    app.post('/api/conversations', (req, res) => {
        const convs = ctx.store.read('conversations.json', []);
        const defaultWorkspace = ctx.workspaceStore.workspaces()[0];
        const defaultProject = ctx.workspaceStore.projects().find(x => x.workspaceId === defaultWorkspace?.id);
        const { messages: _messages, id: _id, createdAt: _createdAt, ...input } = req.body || {};
        const conv = {
            id: Date.now().toString(36),
            createdAt: new Date().toISOString(),
            compareMode: false,
            modelA: '',
            modelB: '',
            systemPrompt: '',
            inputPlaceholder: '',
            workspaceId: input.workspaceId || defaultWorkspace?.id || null,
            projectId: input.projectId || defaultProject?.id || null,
            ...input,
        };
        convs.unshift(conv);
        ctx.store.write('conversations.json', convs);
        ctx.store.write(`messages_${conv.id}.json`, []);
        res.json(conv);
    });
    app.put('/api/conversations/:id', (req, res) => {
        const convs = ctx.store.read('conversations.json', []);
        const idx = convs.findIndex(c => c.id === req.params.id);
        if (idx < 0)
            return res.status(404).json({ error: 'not found' });
        const { messages: _messages, createdAt: _createdAt, ...changes } = req.body || {};
        convs[idx] = { ...convs[idx], ...changes, id: req.params.id };
        ctx.store.write('conversations.json', convs);
        res.json(convs[idx]);
    });
    app.delete('/api/conversations/:id', (req, res) => {
        if (!assertSafeId(res, req.params.id))
            return;
        let convs = ctx.store.read('conversations.json', []);
        convs = convs.filter(c => c.id !== req.params.id);
        ctx.store.write('conversations.json', convs);
        const messageFile = `messages_${req.params.id}.json`;
        ctx.store.remove(messageFile);
        res.json({ ok: true });
    });
    // Save messages for a conversation
    app.post('/api/conversations/:id/messages', (req, res) => {
        if (!assertSafeId(res, req.params.id))
            return;
        const convs = ctx.store.read('conversations.json', []);
        if (!convs.find(c => c.id === req.params.id))
            return res.status(404).json({ error: 'not found' });
        ctx.store.write(`messages_${req.params.id}.json`, req.body);
        res.json({ ok: true });
    });
};
//# sourceMappingURL=conversations.js.map