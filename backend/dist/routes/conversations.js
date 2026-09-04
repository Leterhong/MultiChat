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
function bodyObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function optionalText(input, key, max) {
    if (input[key] === undefined)
        return {};
    const value = String(input[key] || '').trim().slice(0, max);
    return { [key]: value };
}
function conversationChanges(raw) {
    const input = bodyObject(raw);
    return {
        ...optionalText(input, 'title', 200),
        ...optionalText(input, 'modelA', 200),
        ...optionalText(input, 'modelB', 200),
        ...optionalText(input, 'systemPrompt', 30_000),
        ...optionalText(input, 'inputPlaceholder', 500),
        ...(input.compareMode !== undefined ? { compareMode: input.compareMode === true } : {}),
        ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId ? ctx.safeId(input.workspaceId, 'workspace id') : null } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId ? ctx.safeId(input.projectId, 'project id') : null } : {}),
    };
}
function validateConversationLocation(workspaceId, projectId) {
    const workspace = workspaceId ? ctx.workspaceStore.getWorkspace(workspaceId) : null;
    const project = projectId ? ctx.workspaceStore.getProject(projectId) : null;
    if (workspaceId && !workspace)
        throw new Error('workspace not found');
    if (projectId && !project)
        throw new Error('project not found');
    if (workspace && project && project.workspaceId !== workspace.id)
        throw new Error('project does not belong to workspace');
}
function validateMessages(value) {
    if (!Array.isArray(value))
        throw new Error('messages must be an array');
    if (value.length > 2_000)
        throw new Error('messages exceed 2000 entries');
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 16_000_000)
        throw new Error('messages exceed 16 MB');
    for (const message of value) {
        if (!message || typeof message !== 'object' || Array.isArray(message))
            throw new Error('each message must be an object');
        if (!['system', 'user', 'assistant', 'tool'].includes(message.role) || typeof message.content !== 'string') {
            throw new Error('each message requires a valid role and string content');
        }
    }
    return value;
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
        try {
            const convs = ctx.store.read('conversations.json', []);
            const defaultWorkspace = ctx.workspaceStore.workspaces()[0];
            const input = conversationChanges(req.body);
            const workspaceId = input.workspaceId || defaultWorkspace?.id || null;
            const defaultProject = ctx.workspaceStore.projects().find(x => x.workspaceId === workspaceId);
            const projectId = input.projectId || defaultProject?.id || null;
            validateConversationLocation(workspaceId, projectId);
            const conv = {
                compareMode: false,
                modelA: '',
                modelB: '',
                systemPrompt: '',
                inputPlaceholder: '',
                title: '新对话',
                ...input,
                id: Date.now().toString(36),
                createdAt: new Date().toISOString(),
                workspaceId,
                projectId,
            };
            convs.unshift(conv);
            ctx.store.write('conversations.json', convs);
            ctx.store.write(`messages_${conv.id}.json`, []);
            res.json(conv);
        }
        catch (error) {
            res.status(400).json({ error: error.message, code: 'BAD_REQUEST' });
        }
    });
    app.put('/api/conversations/:id', (req, res) => {
        if (!assertSafeId(res, req.params.id))
            return;
        try {
            const convs = ctx.store.read('conversations.json', []);
            const idx = convs.findIndex(c => c.id === req.params.id);
            if (idx < 0)
                return res.status(404).json({ error: 'not found' });
            const changes = conversationChanges(req.body);
            const next = { ...convs[idx], ...changes, id: req.params.id, createdAt: convs[idx].createdAt };
            validateConversationLocation(next.workspaceId, next.projectId);
            convs[idx] = next;
            ctx.store.write('conversations.json', convs);
            res.json(next);
        }
        catch (error) {
            res.status(400).json({ error: error.message, code: 'BAD_REQUEST' });
        }
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
        try {
            ctx.store.write(`messages_${req.params.id}.json`, validateMessages(req.body));
            res.json({ ok: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message, code: 'BAD_REQUEST' });
        }
    });
};
//# sourceMappingURL=conversations.js.map