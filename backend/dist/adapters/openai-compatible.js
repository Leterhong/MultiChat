"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseAdapter = require('./base');
/** Shared implementation for providers that expose OpenAI chat completions. */
class OpenAICompatibleAdapter extends BaseAdapter {
    compatibility;
    constructor(config, compatibility = {}) {
        super(config);
        this.compatibility = compatibility;
    }
    transformMessages(messages) { return messages; }
    buildRequestBody(model, messages, stream, options = {}) {
        return { model, messages: this.transformMessages(messages), stream, ...options };
    }
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.compatibility.auth === 'required' || (this.compatibility.auth !== 'none' && this.config.apiKey)) {
            headers.Authorization = `Bearer ${this.config.apiKey || ''}`;
        }
        return headers;
    }
    getEndpoint() {
        const baseUrl = String(this.config.baseUrl || this.compatibility.defaultBaseUrl || '').replace(/\/+$/, '');
        if (!baseUrl)
            throw new Error('provider baseUrl is required');
        if (/\/chat\/completions$/i.test(baseUrl))
            return baseUrl;
        const versioned = /\/(?:v\d+(?:[a-z0-9_-]+)?|openai)$/i.test(baseUrl);
        return `${baseUrl}${versioned ? '' : '/v1'}/chat/completions`;
    }
    transformSSEChunk(line) {
        if (!line.startsWith('data:'))
            return null;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]')
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    transformResponse(data) { return data; }
}
module.exports = OpenAICompatibleAdapter;
//# sourceMappingURL=openai-compatible.js.map