const OpenAICompatibleAdapter = require('./openai-compatible');

class OllamaAdapter extends OpenAICompatibleAdapter {
  constructor(config) { super(config, { defaultBaseUrl: 'http://localhost:11434', auth: 'optional' }); }
}

module.exports = OllamaAdapter;
