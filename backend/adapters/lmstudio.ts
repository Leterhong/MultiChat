const BaseAdapter = require('./base');
import type { ChatMessage, ChatRequestOptions, JsonRecord } from '../types';

/**
 * LM Studio Adapter
 * LM Studio exposes a fully OpenAI-compatible API.
 * Default base URL: http://localhost:1234
 * No API key required (uses "lm-studio" as a placeholder if needed).
 */
class LMStudioAdapter extends BaseAdapter {
  transformMessages(messages) {
    return messages;
  }

  buildRequestBody(model: string, messages: ChatMessage[], stream: boolean, options: ChatRequestOptions = {}) {
    const body: JsonRecord = {
      model,
      messages: this.transformMessages(messages),
      stream,
    };
    if (options.temperature != null) body.temperature = options.temperature;
    if (options.max_tokens != null) body.max_tokens = options.max_tokens;
    if (options.top_p != null) body.top_p = options.top_p;
    return body;
  }

  getHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // LM Studio accepts any Bearer token; send one only when configured
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  getEndpoint() {
    const base = (this.config.baseUrl || 'http://localhost:1234').replace(/\/+$/, '');
    return `${base}/v1/chat/completions`;
  }

  transformSSEChunk(line) {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6).trim();
    if (data === '[DONE]') return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  transformResponse(data) {
    return data;
  }
}

module.exports = LMStudioAdapter;
