const BaseAdapter = require('./base');

class MoonshotAdapter extends BaseAdapter {
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
    const baseUrl = this.config.baseUrl || 'https://api.moonshot.cn';
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}${/\/v1$/i.test(base) ? '' : '/v1'}/chat/completions`;
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

module.exports = MoonshotAdapter;
