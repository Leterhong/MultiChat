// Base adapter interface for all LLM providers
import type { AdapterConfig, ChatMessage, ChatRequestOptions, JsonRecord } from '../types';

class BaseAdapter {
  config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  // Convert internal message format to provider-specific format
  transformMessages(_messages: ChatMessage[]): any[] {
    throw new Error('transformMessages must be implemented');
  }

  // Build request body for the provider
  buildRequestBody(_model: string, _messages: ChatMessage[], _stream: boolean, _options: ChatRequestOptions = {}): JsonRecord {
    throw new Error('buildRequestBody must be implemented');
  }

  // Get request headers
  getHeaders() {
    throw new Error('getHeaders must be implemented');
  }

  // Get API endpoint URL
  getEndpoint() {
    throw new Error('getEndpoint must be implemented');
  }

  // Transform SSE chunk to standard format
  transformSSEChunk(_line: string): JsonRecord | null {
    throw new Error('transformSSEChunk must be implemented');
  }

  // Transform non-streaming response to standard format
  transformResponse(_data: JsonRecord): JsonRecord {
    throw new Error('transformResponse must be implemented');
  }

  // Prepare before making request (e.g., get access token)
  async prepare() {
    // Optional: override if needed
  }
}

module.exports = BaseAdapter;
