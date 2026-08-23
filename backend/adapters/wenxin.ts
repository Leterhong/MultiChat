const BaseAdapter = require('./base');
import type { AdapterConfig, JsonRecord } from '../types';

interface WenxinTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

class WenxinAdapter extends BaseAdapter {
  accessToken: string | null;
  tokenExpiry: number;

  constructor(config: AdapterConfig) {
    super(config);
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const [apiKey, secretKey] = this.config.apiKey.split(':');
    if (!secretKey) {
      throw new Error('Wenxin API key format error. Expected: apiKey:secretKey');
    }

    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;

    const response = await fetch(tokenUrl);
    const data = await response.json() as WenxinTokenResponse;

    if (data.error) {
      throw new Error(`Failed to get Wenxin access token: ${data.error_description}`);
    }

    this.accessToken = data.access_token || null;
    this.tokenExpiry = Date.now() + ((data.expires_in || 0) - 60) * 1000;

    return this.accessToken;
  }

  async prepare() {
    await this.getAccessToken();
  }

  transformMessages(messages) {
    return messages.map(msg => {
      if (msg.role === 'system') {
        return { role: 'user', content: `[System]: ${msg.content}` };
      }
      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      };
    });
  }

  buildRequestBody(model, messages, stream, options = {}) {
    return {
      messages: this.transformMessages(messages),
      stream,
      ...options
    };
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  getEndpoint() {
    const modelMap = {
      'ernie-4.0': 'completions_pro',
      'ernie-3.5': 'completions',
      'ernie-turbo': 'eb-instant',
      'ernie-speed': 'ernie_speed'
    };

    const endpoint = modelMap[this.config.model] || 'completions_pro';
    return `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${endpoint}?access_token=${this.accessToken}`;
  }

  transformSSEChunk(line) {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6);

    try {
      const parsed = JSON.parse(data);

      // Transform Wenxin format to OpenAI format
      return {
        id: parsed.id,
        object: 'chat.completion.chunk',
        created: parsed.created || Date.now(),
        model: 'ernie',
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
            content: parsed.result || ''
          },
          finish_reason: parsed.is_end ? 'stop' : null
        }]
      };
    } catch {
      return null;
    }
  }

  transformResponse(data: JsonRecord) {
    // Transform Wenxin response to OpenAI format
    return {
      id: data.id,
      object: 'chat.completion',
      created: data.created || Date.now(),
      model: 'ernie',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.result || ''
        },
        finish_reason: 'stop'
      }],
      usage: data.usage || {}
    };
  }
}

module.exports = WenxinAdapter;
