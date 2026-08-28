"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAICompatibleAdapter = require('./openai-compatible');
class OllamaAdapter extends OpenAICompatibleAdapter {
    constructor(config) { super(config, { defaultBaseUrl: 'http://localhost:11434', auth: 'optional' }); }
}
module.exports = OllamaAdapter;
//# sourceMappingURL=ollama.js.map