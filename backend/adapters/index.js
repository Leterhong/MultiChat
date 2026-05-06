const OpenAIAdapter = require('./openai');
const ZhipuAdapter = require('./zhipu');
const MoonshotAdapter = require('./moonshot');
const QwenAdapter = require('./qwen');
const WenxinAdapter = require('./wenxin');
const OllamaAdapter = require('./ollama');
const LMStudioAdapter = require('./lmstudio');

const ADAPTER_MAP = {
  'openai': OpenAIAdapter,
  'zhipu': ZhipuAdapter,
  'moonshot': MoonshotAdapter,
  'kimi': MoonshotAdapter,
  'qwen': QwenAdapter,
  'wenxin': WenxinAdapter,
  'ernie': WenxinAdapter,
  'ollama': OllamaAdapter,
  'lmstudio': LMStudioAdapter
};

function createAdapter(provider) {
  const adapterType = provider.apiType || 'openai';
  const AdapterClass = ADAPTER_MAP[adapterType.toLowerCase()];

  if (!AdapterClass) {
    throw new Error(`Unknown adapter type: ${adapterType}`);
  }

  return new AdapterClass({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model
  });
}

module.exports = {
  createAdapter,
  ADAPTER_MAP
};
