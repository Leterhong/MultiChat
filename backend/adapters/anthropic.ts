const BaseAdapter = require('./base');
import type { ChatMessage, ChatRequestOptions, JsonRecord } from '../types';

function asText(content: unknown) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(x => x && x.type === 'text').map(x => x.text || '').join('');
}

class AnthropicAdapter extends BaseAdapter {
  transformMessages(messages: ChatMessage[]) {
    const out: any[] = [];
    for (const message of messages || []) {
      if (message.role === 'system') continue;
      if (message.role === 'tool') {
        out.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: message.tool_call_id, content: String(message.content || '') }] });
        continue;
      }
      if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
        const content: any[] = [];
        if (message.content) content.push({ type: 'text', text: String(message.content) });
        for (const call of message.tool_calls) {
          content.push({ type: 'tool_use', id: call.id, name: call.function?.name, input: this.parseArguments(call.function?.arguments) });
        }
        out.push({ role: 'assistant', content });
        continue;
      }
      out.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content });
    }
    return out;
  }

  parseArguments(value: string | undefined) {
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  }

  buildRequestBody(model: string, messages: ChatMessage[], stream: boolean, options: ChatRequestOptions = {}) {
    const system = (messages || []).filter(m => m.role === 'system').map(m => asText(m.content)).filter(Boolean).join('\n\n');
    const body: JsonRecord = {
      model,
      messages: this.transformMessages(messages),
      max_tokens: options.max_tokens || 4096,
      stream,
    };
    if (system) body.system = system;
    for (const key of ['temperature', 'top_p', 'stop_sequences']) if (options[key] !== undefined) body[key] = options[key];
    if (Array.isArray(options.tools)) {
      body.tools = options.tools.map(tool => ({
        name: tool.function?.name,
        description: tool.function?.description || '',
        input_schema: tool.function?.parameters || { type: 'object', properties: {}, required: [] },
      }));
    }
    if (options.tool_choice !== undefined) {
      const choice = options.tool_choice;
      body.tool_choice = choice === 'auto' ? { type: 'auto' } : choice === 'required' ? { type: 'any' } : choice?.function?.name ? { type: 'tool', name: choice.function.name } : undefined;
    }
    return body;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey || '',
      'anthropic-version': '2023-06-01',
    };
  }

  getEndpoint() {
    return `${(this.config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '')}/messages`;
  }

  transformSSEChunk(line: string) {
    if (!line.startsWith('data:')) return null;
    const raw = line.slice(5).trim();
    if (!raw || raw === '[DONE]') return null;
    let event;
    try { event = JSON.parse(raw); } catch { return null; }
    if (event.type === 'message_start') {
      return { id: event.message?.id, model: event.message?.model, choices: [], usage: event.message?.usage };
    }
    if (event.type === 'content_block_start') {
      const block = event.content_block || {};
      if (block.type === 'tool_use') return { choices: [{ delta: { tool_calls: [{ index: event.index || 0, id: block.id, type: 'function', function: { name: block.name, arguments: '' } }] } }] };
      return null;
    }
    if (event.type === 'content_block_delta') {
      const delta = event.delta || {};
      if (delta.type === 'text_delta' && delta.text) return { choices: [{ delta: { content: delta.text } }] };
      if (delta.type === 'input_json_delta' && delta.partial_json) return { choices: [{ delta: { tool_calls: [{ index: event.index || 0, function: { arguments: delta.partial_json } }] } }] };
      return null;
    }
    if (event.type === 'message_delta') {
      const stop = event.delta?.stop_reason;
      const finish = stop === 'tool_use' ? 'tool_calls' : (stop || 'stop');
      return { choices: [{ delta: {}, finish_reason: finish }], usage: event.usage ? { completion_tokens: event.usage.output_tokens } : undefined };
    }
    return null;
  }

  transformResponse(data: JsonRecord) {
    const content = (data.content || []).filter(x => x.type === 'text').map(x => x.text || '').join('');
    return {
      id: data.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop' }],
      usage: data.usage ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens, total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) } : undefined,
    };
  }
}

module.exports = AnthropicAdapter;
