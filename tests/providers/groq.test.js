const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const groq = require('../../providers/groq');

const ctx = {
  settings: { apiKey: 'gsk-test-key' },
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

describe('providers/groq buildChatCompletionBody', () => {
  const messages = [{ role: 'user', content: 'hi' }];

  it('caps output tokens and uses max_completion_tokens', () => {
    const body = groq.buildChatCompletionBody({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
    });
    assert.equal(body.model, 'llama-3.3-70b-versatile');
    assert.equal(body.temperature, 0.7);
    assert.equal(body.max_completion_tokens, groq.GROQ_MAX_OUTPUT_TOKENS);
    assert.equal(body.max_completion_tokens, 16_384);
    assert.equal(body.max_tokens, undefined);
  });

  it('defaults temperature to 1', () => {
    const body = groq.buildChatCompletionBody({ model: 'llama-3.1-8b-instant', messages });
    assert.equal(body.temperature, 1);
  });
});

describe('providers/groq generate request body', () => {
  let originalFetch;
  let lastRequest;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    lastRequest = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function captureFetch() {
    globalThis.fetch = async (_url, opts) => {
      lastRequest = {
        body: JSON.parse(opts.body),
      };
      return mockOkJson({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    };
  }

  it('sends capped max_completion_tokens instead of max_tokens 65535', async () => {
    captureFetch();
    const result = await groq.generate(ctx, {
      model: 'llama-3.3-70b-versatile',
      prompt: 'sys',
      data: 'hi',
      temperature: 0.5,
    });
    assert.equal(result.ok, true);
    assert.equal(lastRequest.body.max_completion_tokens, 16_384);
    assert.equal(lastRequest.body.max_tokens, undefined);
    assert.equal(lastRequest.body.temperature, 0.5);
    assert.deepEqual(lastRequest.body.messages, [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
  });
});

describe('providers/groq listModels', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns fallback models without API key', async () => {
    const models = await groq.listModels({ settings: {} });
    assert.deepEqual(models, groq.fallbackModels);
  });

  it('filters non-chat models from API response', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'llama-3.3-70b-versatile' },
          { id: 'whisper-large-v3' },
          { id: 'gemma2-9b-it' },
        ],
      }),
    });

    const models = await groq.listModels(ctx);
    assert.deepEqual(
      models.map((m) => m.id),
      ['gemma2-9b-it', 'llama-3.3-70b-versatile'],
    );
  });

  it('throws on HTTP error so registry can surface warning', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid API key' } }),
    });

    await assert.rejects(
      () => groq.listModels(ctx),
      (err) => {
        assert.match(err.message, /Invalid API key/);
        assert.match(err.message, /\[groq\]/);
        return true;
      },
    );
  });
});
