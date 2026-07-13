const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const anthropic = require('../../providers/anthropic');

const ctx = {
  settings: { apiKey: 'sk-ant-test' },
  getDataPath: (f) => `/tmp/${f}`,
  readJSON: () => null,
};

function mockOkJson(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

describe('providers/anthropic generate', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns ok:false when content has no text parts', async () => {
    globalThis.fetch = async () =>
      mockOkJson({ content: [], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 0 } });

    const result = await anthropic.generate(ctx, {
      model: 'claude-3-5-haiku-20241022',
      prompt: '',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'anthropic no devolvió texto (finishReason: end_turn).');
  });

  it('returns ok:false when text parts are empty', async () => {
    globalThis.fetch = async () =>
      mockOkJson({
        content: [{ type: 'text', text: '   ' }],
        stop_reason: 'max_tokens',
      });

    const result = await anthropic.generate(ctx, {
      model: 'claude-3-5-haiku-20241022',
      prompt: '',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'anthropic no devolvió texto (finishReason: max_tokens).');
  });

  it('returns ok:true with joined text on success', async () => {
    globalThis.fetch = async (url, init) => {
      assert.match(url, /\/messages$/);
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['x-api-key'], 'sk-ant-test');
      return mockOkJson({
        content: [
          { type: 'text', text: 'hola' },
          { type: 'text', text: ' mundo' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 2, output_tokens: 3 },
      });
    };

    const result = await anthropic.generate(ctx, {
      model: 'claude-3-5-haiku-20241022',
      prompt: 'sys',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, 'hola mundo');
    assert.equal(result.finishReason, 'end_turn');
    assert.deepEqual(result.usage, {
      promptTokenCount: 2,
      candidatesTokenCount: 3,
      totalTokenCount: 5,
    });
  });
});
