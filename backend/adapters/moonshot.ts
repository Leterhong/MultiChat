const OpenAICompatibleAdapter = require('./openai-compatible');

class MoonshotAdapter extends OpenAICompatibleAdapter {
  constructor(config) { super(config, { defaultBaseUrl: 'https://api.moonshot.cn', auth: 'required' }); }
}

module.exports = MoonshotAdapter;
