'use strict';
// ── Conversations CRUD ──────────────────────────────────────────────────
const ctx = require('../lib/context');

module.exports = function registerConversations(app) {
  app.get('/api/conversations', (req, res) => {
    res.json(ctx.store.read('conversations.json', []));
  });
  app.get('/api/conversations/:id', (req, res) => {
    const convs = ctx.store.read('conversations.json', []);
    const conv = convs.find(c => c.id === req.params.id);
    if (!conv) return res.status(404).json({ error: 'not found' });
    const messages = ctx.store.read(`messages_${req.params.id}.json`, []);
    res.json({ ...conv, messages });
  });
  app.post('/api/conversations', (req, res) => {
    const convs = ctx.store.read('conversations.json', []);
    const defaultWorkspace = ctx.workspaceStore.workspaces()[0];
    const defaultProject = ctx.workspaceStore.projects().find(x => x.workspaceId === defaultWorkspace?.id);
    const conv = {
      id: Date.now().toString(36),
      createdAt: new Date().toISOString(),
      compareMode: false,
      modelA: '',
      modelB: '',
      systemPrompt: '',
      inputPlaceholder: '',
      workspaceId: req.body?.workspaceId || defaultWorkspace?.id || null,
      projectId: req.body?.projectId || defaultProject?.id || null,
      ...req.body,
    };
    convs.unshift(conv);
    ctx.store.write('conversations.json', convs);
    ctx.store.write(`messages_${conv.id}.json`, []);
    res.json(conv);
  });
  app.put('/api/conversations/:id', (req, res) => {
    const convs = ctx.store.read('conversations.json', []);
    const idx = convs.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'not found' });
    convs[idx] = { ...convs[idx], ...req.body, id: req.params.id };
    ctx.store.write('conversations.json', convs);
    res.json(convs[idx]);
  });
  app.delete('/api/conversations/:id', (req, res) => {
    let convs = ctx.store.read('conversations.json', []);
    convs = convs.filter(c => c.id !== req.params.id);
    ctx.store.write('conversations.json', convs);
    const messageFile = `messages_${req.params.id}.json`;
    if (ctx.fs.existsSync(ctx.store.resolve(messageFile))) ctx.store.remove(messageFile);
    res.json({ ok: true });
  });
  // Save messages for a conversation
  app.post('/api/conversations/:id/messages', (req, res) => {
    const convs = ctx.store.read('conversations.json', []);
    if (!convs.find(c => c.id === req.params.id)) return res.status(404).json({ error: 'not found' });
    ctx.store.write(`messages_${req.params.id}.json`, req.body);
    res.json({ ok: true });
  });
};
