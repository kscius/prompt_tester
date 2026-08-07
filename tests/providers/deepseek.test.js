const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const deepseek = require('../../providers/deepseek');

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

describe('providers/deepseek fallbackModels', () => {
  it('uses DeepSeek V4 ids instead of deprecated chat/reasoner aliases', () => {
    const ids = deepseek.fallbackModels.map((m) => m.id);
    assert.deepEqual(ids, ['deepseek-v4-flash', 'deepseek-v4-pro']);
    assert.ok(!ids.includes('deepseek-chat'));
    assert.ok(!ids.includes('deepseek-reasoner'));
  });
});

describe('providers/deepseek isThinkingModel', () => {
  it('detects legacy reasoner alias', () => {
    assert.equal(deepseek.isThinkingModel('deepseek-reasoner'), true);
    assert.equal(deepseek.isThinkingModel('DeepSeek-Reasoner'), true);
  });

  it('rejects V4 and chat models', () => {
    for (const id of ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', '']) {
      assert.equal(deepseek.isThinkingModel(id), false, id);
    }
  });
});

describe('providers/deepseek getMaxOutputTokens', () => {
  it('caps legacy chat and reasoner aliases at 8192', () => {
    assert.equal(deepseek.getMaxOutputTokens('deepseek-chat'), 8192);
    assert.equal(deepseek.getMaxOutputTokens('deepseek-reasoner'), 8192);
    assert.equal(deepseek.getMaxOutputTokens('DeepSeek-Chat'), 8192);
  });

  it('allows 65535 for V4 models', () => {
    assert.equal(deepseek.getMaxOutputTokens('deepseek-v4-flash'), 65_535);
    assert.equal(deepseek.getMaxOutputTokens('deepseek-v4-pro'), 65_535);
  });

  it('defaults unknown deepseek ids to 8192', () => {
    assert.equal(deepseek.getMaxOutputTokens('deepseek-future-model'), 8192);
    assert.equal(deepseek.getMaxOutputTokens(''), 8192);
  });
});

describe('providers/deepseek buildChatCompletionBody', () => {
  const messages = [{ role: 'user', content: 'hi' }];

  it('includes temperature for V4 / chat models', () => {
    const body = deepseek.buildChatCompletionBody({
      model: 'deepseek-v4-flash',
      messages,
      temperature: 0.4,
    });
    assert.equal(body.model, 'deepseek-v4-flash');
    assert.equal(body.temperature, 0.4);
    assert.equal(body.max_tokens, 65535);
  });

  it('omits temperature for deepseek-reasoner', () => {
    const body = deepseek.buildChatCompletionBody({
      model: 'deepseek-reasoner',
      messages,
      temperature: 0.4,
    });
    assert.equal(body.model, 'deepseek-reasoner');
    assert.equal(body.temperature, undefined);
    assert.equal(body.max_tokens, 8192);
  });

  it('caps max_tokens for legacy deepseek-chat', () => {
    const body = deepseek.buildChatCompletionBody({
      model: 'deepseek-chat',
      messages,
      temperature: 1,
    });
    assert.equal(body.max_tokens, 8192);
  });
});

describe('providers/deepseek extractDeepSeekMessageText', () => {
  it('prefers content over reasoning_content', () => {
    assert.equal(
      deepseek.extractDeepSeekMessageText({
        content: 'respuesta final',
        reasoning_content: 'pensamiento',
      }),
      'respuesta final'
    );
  });

  it('falls back to reasoning_content when content is empty', () => {
    assert.equal(
      deepseek.extractDeepSeekMessageText({
        content: '',
        reasoning_content: 'solo razonamiento',
      }),
      'solo razonamiento'
    );
  });

  it('joins array content parts', () => {
    assert.equal(
      deepseek.extractDeepSeekMessageText({
        content: [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
      }),
      'ab'
    );
  });
});

describe('providers/deepseek generate request body', () => {
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
      lastRequest = { body: JSON.parse(opts.body) };
      return mockOkJson({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      });
    };
  }

  it('sends temperature for deepseek-v4-pro', async () => {
    captureFetch();
    await deepseek.generate(ctx, {
      model: 'deepseek-v4-pro',
      prompt: 'sys',
      data: 'hi',
      temperature: 0.7,
    });
    assert.equal(lastRequest.body.model, 'deepseek-v4-pro');
    assert.equal(lastRequest.body.temperature, 0.7);
    assert.equal(lastRequest.body.max_tokens, 65535);
  });

  it('sends capped max_tokens for deepseek-reasoner instead of 65535', async () => {
    captureFetch();
    await deepseek.generate(ctx, {
      model: 'deepseek-reasoner',
      prompt: '',
      data: 'hi',
      temperature: 0.7,
    });
    assert.equal(lastRequest.body.model, 'deepseek-reasoner');
    assert.equal(lastRequest.body.temperature, undefined);
    assert.equal(lastRequest.body.max_tokens, 8192);
  });
});

describe('providers/deepseek generate reasoning_content', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns reasoning_content when final content is empty', async () => {
    globalThis.fetch = async () =>
      mockOkJson({
        choices: [
          {
            message: { content: '', reasoning_content: '1+1=2' },
            finish_reason: 'length',
          },
        ],
        usage: { prompt_tokens: 2, completion_tokens: 8, total_tokens: 10 },
      });

    const result = await deepseek.generate(ctx, {
      model: 'deepseek-v4-flash',
      prompt: '',
      data: '1+1?',
      temperature: 1,
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, '1+1=2');
    assert.equal(result.finishReason, 'length');
  });

  it('still rejects when both content and reasoning_content are empty', async () => {
    globalThis.fetch = async () =>
      mockOkJson({
        choices: [
          {
            message: { content: '', reasoning_content: '' },
            finish_reason: 'stop',
          },
        ],
      });

    const result = await deepseek.generate(ctx, {
      model: 'deepseek-v4-flash',
      prompt: '',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'deepseek no devolvió texto (finishReason: stop).');
  });
});
