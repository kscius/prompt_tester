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

describe('providers/anthropic getMaxOutputTokens', () => {
  it('caps opus-3 models at 4096', () => {
    assert.equal(anthropic.getMaxOutputTokens('claude-3-opus-20240229'), 4096);
  });

  it('caps claude-3-5 sonnet and haiku at 8192', () => {
    assert.equal(anthropic.getMaxOutputTokens('claude-3-5-sonnet-20241022'), 8192);
    assert.equal(anthropic.getMaxOutputTokens('claude-3-5-haiku-20241022'), 8192);
  });

  it('allows 64000 for sonnet-4 and 3.7 models', () => {
    assert.equal(anthropic.getMaxOutputTokens('claude-sonnet-4-20250514'), 64_000);
    assert.equal(anthropic.getMaxOutputTokens('claude-3-7-sonnet-20250219'), 64_000);
  });

  it('defaults unknown models to 8192', () => {
    assert.equal(anthropic.getMaxOutputTokens('claude-future-model'), 8192);
  });
});

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
      const body = JSON.parse(init.body);
      assert.equal(body.max_tokens, 8192);
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

  it('sends model-specific max_tokens instead of 65535', async () => {
    let lastBody;
    globalThis.fetch = async (_url, init) => {
      lastBody = JSON.parse(init.body);
      return mockOkJson({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    };

    const result = await anthropic.generate(ctx, {
      model: 'claude-3-opus-20240229',
      prompt: '',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, true);
    assert.equal(lastBody.max_tokens, 4096);
  });
});
