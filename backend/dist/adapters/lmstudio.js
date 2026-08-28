"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAICompatibleAdapter = require('./openai-compatible');
class LMStudioAdapter extends OpenAICompatibleAdapter {
    constructor(config) { super(config, { defaultBaseUrl: 'http://localhost:1234', auth: 'optional' }); }
}
module.exports = LMStudioAdapter;
//# sourceMappingURL=lmstudio.js.map