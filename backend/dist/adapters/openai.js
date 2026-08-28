"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAICompatibleAdapter = require('./openai-compatible');
class OpenAIAdapter extends OpenAICompatibleAdapter {
    constructor(config) { super(config, { auth: 'required' }); }
}
module.exports = OpenAIAdapter;
//# sourceMappingURL=openai.js.map