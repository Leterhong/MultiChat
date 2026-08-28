"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseAdapter = require('./base');
class QwenAdapter extends BaseAdapter {
    transformMessages(messages) {
        return messages.map(msg => {
            if (msg.role === 'system') {
                return { role: 'system', content: msg.content };
            }
            if (msg.role === 'user') {
                // Handle multi-modal
                if (Array.isArray(msg.content)) {
                    return { role: 'user', content: msg.content };
                }
                return { role: 'user', content: msg.content };
            }
            if (msg.role === 'assistant') {
                return { role: 'assistant', content: msg.content };
            }
            return msg;
        });
    }
    buildRequestBody(model, messages, stream, options = {}) {
        const body = {
            model,
            input: {
                messages: this.transformMessages(messages)
            },
            parameters: {
                result_format: 'message',
                incremental_output: stream,
                ...options
            }
        };
        if (stream) {
            body.parameters.stream = true;
        }
        return body;
    }
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-DashScope-SSE': 'enable'
        };
    }
    getEndpoint() {
        const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com';
        return `${baseUrl.replace(/\/+$/, '')}/api/v1/services/aigc/text-generation/generation`;
    }
    transformSSEChunk(line) {
        if (!line.startsWith('data:'))
            return null;
        const data = line.slice(5).trim();
        try {
            const parsed = JSON.parse(data);
            // Transform Qwen format to OpenAI format
            if (parsed.output && parsed.output.choices) {
                return {
                    id: parsed.request_id,
                    object: 'chat.completion.chunk',
                    created: Date.now(),
                    model: parsed.model || 'qwen',
                    choices: parsed.output.choices.map(choice => ({
                        index: 0,
                        delta: {
                            role: choice.message?.role,
                            content: choice.message?.content || ''
                        },
                        finish_reason: choice.finish_reason || null
                    }))
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    transformResponse(data) {
        // Transform Qwen response to OpenAI format
        if (data.output && data.output.choices) {
            return {
                id: data.request_id,
                object: 'chat.completion',
                created: Date.now(),
                model: data.model || 'qwen',
                choices: data.output.choices.map(choice => ({
                    index: 0,
                    message: {
                        role: choice.message?.role || 'assistant',
                        content: choice.message?.content || ''
                    },
                    finish_reason: choice.finish_reason || 'stop'
                })),
                usage: data.usage || {}
            };
        }
        return data;
    }
}
module.exports = QwenAdapter;
//# sourceMappingURL=qwen.js.map