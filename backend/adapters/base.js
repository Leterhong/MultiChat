// Base adapter interface for all LLM providers
class BaseAdapter {
  constructor(config) {
    this.config = config;
  }

  // Convert internal message format to provider-specific format
  transformMessages(messages) {
    throw new Error('transformMessages must be implemented');
  }

  // Build request body for the provider
  buildRequestBody(model, messages, stream) {
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
  transformSSEChunk(line) {
    throw new Error('transformSSEChunk must be implemented');
  }

  // Transform non-streaming response to standard format
  transformResponse(data) {
    throw new Error('transformResponse must be implemented');
  }

  // Prepare before making request (e.g., get access token)
  async prepare() {
    // Optional: override if needed
  }
}

module.exports = BaseAdapter;
