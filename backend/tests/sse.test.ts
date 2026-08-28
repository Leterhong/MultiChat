import test from 'node:test';
import assert from 'node:assert/strict';
const { SSEDecoder } = require('../lib/sse');

test('SSE decoder preserves split and multi-line data events', () => {
  const decoder = new SSEDecoder();
  assert.deepEqual(decoder.push(': keep-alive\r\ndata: {"value":\r\n'), []);
  assert.deepEqual(decoder.push('data: 1}\r\n\r\n'), ['data: {"value":\n1}']);
  assert.deepEqual(decoder.push('event: message\ndata: [DONE]\n\n'), ['data: [DONE]']);
  assert.deepEqual(decoder.flush(), []);
});
