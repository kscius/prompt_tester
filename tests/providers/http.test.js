const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  LIST_MODELS_TIMEOUT_MS,
  GENERATE_TIMEOUT_MS,
  isAbortError,
  timeoutErrorMessage,
  fetchWithTimeout,
} = require('../../providers/http');

describe('providers/http', () => {
  describe('timeoutErrorMessage', () => {
    it('formats generate timeouts with provider and seconds', () => {
      assert.equal(
        timeoutErrorMessage({ providerId: 'openai', timeoutMs: 120_000, operation: 'generate' }),
        '[openai] Tiempo de espera agotado al generar la respuesta (120s). Intenta de nuevo.',
      );
    });

    it('formats listModels timeouts', () => {
      assert.equal(
        timeoutErrorMessage({ providerId: 'gemini', timeoutMs: 30_000, operation: 'listModels' }),
        '[gemini] Tiempo de espera agotado al listar modelos (30s). Intenta de nuevo.',
      );
    });

    it('works without provider id', () => {
      assert.equal(
        timeoutErrorMessage({ timeoutMs: 5_000, operation: 'generate' }),
        'Tiempo de espera agotado al generar la respuesta (5s). Intenta de nuevo.',
      );
    });
  });

  describe('isAbortError', () => {
    it('detects AbortError by name or code', () => {
      assert.equal(isAbortError({ name: 'AbortError' }), true);
      assert.equal(isAbortError({ code: 'ABORT_ERR' }), true);
      assert.equal(isAbortError(new Error('network')), false);
      assert.equal(isAbortError(null), false);
    });
  });

  describe('fetchWithTimeout', () => {
    let originalFetch;
    let originalSetTimeout;
    let originalClearTimeout;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      originalSetTimeout = globalThis.setTimeout;
      originalClearTimeout = globalThis.clearTimeout;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    });

    it('passes AbortSignal to fetch and returns the response', async () => {
      let receivedSignal;
      globalThis.fetch = async (_url, options) => {
        receivedSignal = options.signal;
        return { ok: true, status: 200 };
      };

      const res = await fetchWithTimeout('https://example.test', { method: 'GET' }, {
        timeoutMs: GENERATE_TIMEOUT_MS,
        providerId: 'openai',
        operation: 'generate',
      });

      assert.equal(res.ok, true);
      assert.ok(receivedSignal);
      assert.equal(receivedSignal.aborted, false);
    });

    it('throws Spanish AbortError when the request times out', async () => {
      globalThis.fetch = async (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => {
              const err = new Error('This operation was aborted');
              err.name = 'AbortError';
              reject(err);
            },
            { once: true },
          );
        });

      await assert.rejects(
        () =>
          fetchWithTimeout('https://example.test/slow', {}, {
            timeoutMs: 20,
            providerId: 'anthropic',
            operation: 'listModels',
          }),
        (err) => {
          assert.equal(err.name, 'AbortError');
          assert.equal(
            err.message,
            timeoutErrorMessage({
              providerId: 'anthropic',
              timeoutMs: 20,
              operation: 'listModels',
            }),
          );
          return true;
        },
      );
    });

    it('rethrows non-abort errors unchanged', async () => {
      globalThis.fetch = async () => {
        throw new Error('ECONNREFUSED');
      };

      await assert.rejects(
        () =>
          fetchWithTimeout('https://example.test', {}, {
            timeoutMs: LIST_MODELS_TIMEOUT_MS,
            providerId: 'groq',
            operation: 'listModels',
          }),
        { message: 'ECONNREFUSED' },
      );
    });

    it('openai generate maps timeout to ok:false via catch', async () => {
      const openai = require('../../providers/openai');
      globalThis.setTimeout = (callback) => originalSetTimeout(callback, 0);
      globalThis.fetch = async (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            },
            { once: true },
          );
        });

      const result = await openai.generate(
        { settings: { apiKey: 'sk-test' } },
        { model: 'gpt-4o', prompt: '', data: 'hi', temperature: 1 },
      );

      assert.equal(result.ok, false);
      assert.match(result.error, /\[openai\] Tiempo de espera agotado al generar/);
    });
  });
});
