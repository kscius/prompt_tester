const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const openai = require('../../providers/openai');

const ctx = {
  settings: { apiKey: 'sk-test-key' },
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

describe('providers/openai isReasoningModel', () => {
  it('detects o-series ids', () => {
    for (const id of ['o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini', 'o4-mini', 'O3-MINI']) {
      assert.equal(openai.isReasoningModel(id), true, id);
    }
  });

  it('rejects classic chat models', () => {
    for (const id of ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'chatgpt-4o-latest', '']) {
      assert.equal(openai.isReasoningModel(id), false, id);
    }
  });
});

describe('providers/openai buildChatCompletionBody', () => {
  const messages = [{ role: 'user', content: 'hi' }];

  it('uses max_tokens and temperature for gpt models', () => {
    const body = openai.buildChatCompletionBody({
      model: 'gpt-4o',
      messages,
      temperature: 0.4,
    });
    assert.equal(body.model, 'gpt-4o');
    assert.equal(body.temperature, 0.4);
    assert.equal(body.max_tokens, 65535);
    assert.equal(body.max_completion_tokens, undefined);
  });

  it('uses max_completion_tokens and omits temperature for o-series', () => {
    const body = openai.buildChatCompletionBody({
      model: 'o3-mini',
      messages,
      temperature: 0.4,
    });
    assert.equal(body.model, 'o3-mini');
    assert.equal(body.max_completion_tokens, 65535);
    assert.equal(body.temperature, undefined);
    assert.equal(body.max_tokens, undefined);
  });
});

describe('providers/openai generate request body', () => {
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

  it('sends classic params for gpt-4o', async () => {
    captureFetch();
    const result = await openai.generate(ctx, {
      model: 'gpt-4o',
      prompt: 'sys',
      data: 'hi',
      temperature: 0.5,
    });
    assert.equal(result.ok, true);
    assert.equal(lastRequest.body.temperature, 0.5);
    assert.equal(lastRequest.body.max_tokens, 65535);
    assert.equal(lastRequest.body.max_completion_tokens, undefined);
    assert.deepEqual(lastRequest.body.messages, [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('sends reasoning params for o3-mini and maps system to developer', async () => {
    captureFetch();
    const result = await openai.generate(ctx, {
      model: 'o3-mini',
      prompt: 'sys',
      data: 'hi',
      temperature: 0.5,
    });
    assert.equal(result.ok, true);
    assert.equal(lastRequest.body.temperature, undefined);
    assert.equal(lastRequest.body.max_tokens, undefined);
    assert.equal(lastRequest.body.max_completion_tokens, 65535);
    assert.deepEqual(lastRequest.body.messages, [
      { role: 'developer', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('sends reasoning params for o1 without temperature', async () => {
    captureFetch();
    const result = await openai.generate(ctx, {
      model: 'o1',
      prompt: '',
      data: 'solo user',
      temperature: 1,
    });
    assert.equal(result.ok, true);
    assert.equal(lastRequest.body.model, 'o1');
    assert.equal('temperature' in lastRequest.body, false);
    assert.equal('max_tokens' in lastRequest.body, false);
    assert.equal(lastRequest.body.max_completion_tokens, 65535);
    assert.deepEqual(lastRequest.body.messages, [{ role: 'user', content: 'solo user' }]);
  });
});
