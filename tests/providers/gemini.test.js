const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('../../providers/gemini');
const { CORRUPT_ERROR } = require('../../providers/credentials-store');

const ctx = {
  settings: { apiKey: 'AIza-test-key', authMode: 'apiKey' },
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

describe('providers/gemini generate', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns ok:false when promptFeedback.blockReason is set', async () => {
    globalThis.fetch = async () =>
      mockOkJson({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] });

    const result = await gemini.generate(ctx, {
      model: 'gemini-2.5-flash',
      prompt: '',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'Contenido bloqueado por Gemini (SAFETY).');
  });

  it('returns ok:false when candidates are empty', async () => {
    globalThis.fetch = async () => mockOkJson({ candidates: [] });

    const result = await gemini.generate(ctx, {
      model: 'gemini-2.5-flash',
      prompt: '',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'Gemini no devolvió candidatos.');
  });

  it('returns ok:false when finishReason is SAFETY with empty parts', async () => {
    globalThis.fetch = async () =>
      mockOkJson({
        candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }],
      });

    const result = await gemini.generate(ctx, {
      model: 'gemini-2.5-flash',
      prompt: '',
      data: 'hi',
      temperature: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'Respuesta bloqueada por filtros de seguridad (SAFETY).');
  });

  it('returns ok:true with text on success', async () => {
    globalThis.fetch = async (url, init) => {
      assert.match(url, /\/models\/gemini-2\.5-flash:generateContent/);
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['x-goog-api-key'], 'AIza-test-key');
      return mockOkJson({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: 'hola' }] },
          },
        ],
        usageMetadata: {
          promptTokenCount: 2,
          candidatesTokenCount: 1,
          totalTokenCount: 3,
        },
      });
    };

    const result = await gemini.generate(ctx, {
      model: 'gemini-2.5-flash',
      prompt: 'sys',
      data: 'hi',
      temperature: 0.5,
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, 'hola');
    assert.equal(result.finishReason, 'STOP');
    assert.deepEqual(result.usage, {
      promptTokenCount: 2,
      candidatesTokenCount: 1,
      totalTokenCount: 3,
    });
  });
});

describe('providers/gemini service-account credentials', () => {
  const saCtxBase = {
    settings: { authMode: 'serviceAccount' },
    getDataPath: (f) => `/data/${f}`,
  };

  it('treats missing credentials as unconfigured without configuration error', () => {
    const ctxMissing = {
      ...saCtxBase,
      readJSON: () => null,
      fileExists: () => false,
    };

    assert.equal(gemini.isConfigured(ctxMissing), false);
    assert.equal(gemini.getConfigurationError(ctxMissing), null);
  });

  it('surfaces CORRUPT_ERROR when credentials.json exists but is unreadable', () => {
    const ctxCorrupt = {
      ...saCtxBase,
      readJSON: () => null,
      fileExists: () => true,
    };

    assert.equal(gemini.isConfigured(ctxCorrupt), false);
    assert.equal(gemini.getConfigurationError(ctxCorrupt), CORRUPT_ERROR);
  });

  it('is configured for a valid service-account JSON', () => {
    const ctxValid = {
      ...saCtxBase,
      readJSON: () => ({
        type: 'service_account',
        client_email: 'bot@example.com',
        private_key: 'key',
        project_id: 'demo',
      }),
      fileExists: () => true,
    };

    assert.equal(gemini.isConfigured(ctxValid), true);
    assert.equal(gemini.getConfigurationError(ctxValid), null);
  });
});
