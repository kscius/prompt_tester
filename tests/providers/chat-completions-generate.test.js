const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const providers = [
  { id: 'openai', mod: require('../../providers/openai') },
  { id: 'groq', mod: require('../../providers/groq') },
  { id: 'deepseek', mod: require('../../providers/deepseek') },
  { id: 'mistral', mod: require('../../providers/mistral') },
];

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

for (const { id, mod } of providers) {
  describe(`providers/${id} generate empty response`, () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns ok:false when choices are missing', async () => {
      globalThis.fetch = async () => mockOkJson({});

      const result = await mod.generate(ctx, {
        model: 'test-model',
        prompt: '',
        data: 'hi',
        temperature: 1,
      });

      assert.equal(result.ok, false);
      assert.equal(result.error, `${id} no devolvió texto en la respuesta.`);
    });

    it('returns ok:false when message content is empty with finish_reason', async () => {
      globalThis.fetch = async () =>
        mockOkJson({
          choices: [{ message: { content: '' }, finish_reason: 'length' }],
        });

      const result = await mod.generate(ctx, {
        model: 'test-model',
        prompt: '',
        data: 'hi',
        temperature: 1,
      });

      assert.equal(result.ok, false);
      assert.equal(result.error, `${id} no devolvió texto (finishReason: length).`);
    });

    it('returns ok:true with text on success', async () => {
      globalThis.fetch = async () =>
        mockOkJson({
          choices: [{ message: { content: 'hola' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });

      const result = await mod.generate(ctx, {
        model: 'test-model',
        prompt: 'sys',
        data: 'hi',
        temperature: 0.5,
      });

      assert.equal(result.ok, true);
      assert.equal(result.text, 'hola');
      assert.equal(result.finishReason, 'stop');
      assert.deepEqual(result.usage, {
        promptTokenCount: 1,
        candidatesTokenCount: 1,
        totalTokenCount: 2,
      });
    });

    it('joins array message.content instead of returning [object Object]', async () => {
      globalThis.fetch = async () =>
        mockOkJson({
          choices: [
            {
              message: {
                content: [
                  { type: 'text', text: 'parte-a' },
                  { type: 'text', text: ' parte-b' },
                ],
              },
              finish_reason: 'stop',
            },
          ],
        });

      const result = await mod.generate(ctx, {
        model: 'test-model',
        prompt: '',
        data: 'hi',
        temperature: 1,
      });

      assert.equal(result.ok, true);
      assert.equal(result.text, 'parte-a parte-b');
      assert.notEqual(result.text, '[object Object]');
    });

    it('returns ok:false when content array has no usable text parts', async () => {
      globalThis.fetch = async () =>
        mockOkJson({
          choices: [
            {
              message: { content: [{ type: 'image_url', image_url: { url: 'x' } }] },
              finish_reason: 'stop',
            },
          ],
        });

      const result = await mod.generate(ctx, {
        model: 'test-model',
        prompt: '',
        data: 'hi',
        temperature: 1,
      });

      assert.equal(result.ok, false);
      assert.equal(result.error, `${id} no devolvió texto (finishReason: stop).`);
    });
  });
}
