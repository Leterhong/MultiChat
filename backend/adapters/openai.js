const BaseAdapter = require('./base');

class OpenAIAdapter extends BaseAdapter {
  transformMessages(messages) {
    return messages;
  }

  buildRequestBody(model, messages, stream, options = {}) {
    return {
      model,
      messages: this.transformMessages(messages),
      stream,
      ...options
    };
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };
  }

  getEndpoint() {
    return `${this.config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
  }

  transformSSEChunk(line) {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6);
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

module.exports = OpenAIAdapter;
