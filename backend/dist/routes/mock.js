'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// A deterministic, fully local OpenAI-compatible endpoint used by the
// built-in “Mock (本地体验)” provider. It never calls the network and makes the
// first-run/chat/usage UI testable without an API key.
module.exports = function registerMock(app) {
    app.post('/api/mock/v1/chat/completions', (req, res) => {
        const body = req.body || {};
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const last = [...messages].reverse().find(item => item.role === 'user');
        const input = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content || '');
        const output = input ? `本地回声：${input}` : 'MultiChat 本地体验已就绪。';
        const promptTokens = Math.max(1, Math.ceil(JSON.stringify(messages).length / 4));
        const completionTokens = Math.max(1, Math.ceil(output.length / 4));
        const usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens };
        if (body.stream !== true)
            return res.json({ id: `mock-${Date.now()}`, model: body.model || 'echo', choices: [{ index: 0, message: { role: 'assistant', content: output }, finish_reason: 'stop' }], usage });
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        const chunks = output.match(/.{1,8}/gu) || [output];
        for (const content of chunks)
            res.write(`data: ${JSON.stringify({ id: `mock-${Date.now()}`, model: body.model || 'echo', choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ model: body.model || 'echo', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    });
};
//# sourceMappingURL=mock.js.map