"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BaseAdapter {
    config;
    constructor(config) {
        this.config = config;
    }
    // Convert internal message format to provider-specific format
    transformMessages(_messages) {
        throw new Error('transformMessages must be implemented');
    }
    // Build request body for the provider
    buildRequestBody(_model, _messages, _stream, _options = {}) {
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
    transformSSEChunk(_line) {
        throw new Error('transformSSEChunk must be implemented');
    }
    // Transform non-streaming response to standard format
    transformResponse(_data) {
        throw new Error('transformResponse must be implemented');
    }
    // Prepare before making request (e.g., get access token)
    async prepare() {
        // Optional: override if needed
    }
}
module.exports = BaseAdapter;
//# sourceMappingURL=base.js.map