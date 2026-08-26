const BaseAdapter = require('./base');
const crypto = require('crypto');

class ZhipuAdapter extends BaseAdapter {
  // Generate JWT token for Zhipu API
  generateToken() {
    const [apiKey, secret] = this.config.apiKey.split('.');
    if (!secret) {
      throw new Error('Zhipu API key format error. Expected: apiKey.secret');
    }

    const header = {
      alg: 'HS256',
      sign_type: 'SIGN'
    };

    const payload = {
      api_key: apiKey,
      exp: Date.now() + 3600 * 1000,
      timestamp: Date.now()
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  transformMessages(messages) {
    return messages.map(msg => {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content };
      }
      if (msg.role === 'user') {
        // Handle multi-modal images
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
      'Authorization': `Bearer ${this.generateToken()}`
    };
  }

  getEndpoint() {
    const baseUrl = this.config.baseUrl || 'https://open.bigmodel.cn';
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}${/\/api\/paas\/v4$/i.test(base) ? '' : '/api/paas/v4'}/chat/completions`;
  }

  transformSSEChunk(line) {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6);
    if (data === '[DONE]') return null;

    try {
      const parsed = JSON.parse(data);
      // Zhipu format is similar to OpenAI
      return parsed;
    } catch {
      return null;
    }
  }

  transformResponse(data) {
    return data;
  }
}

module.exports = ZhipuAdapter;
