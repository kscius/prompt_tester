const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatHttpError,
  extractMessage,
  emptyGenerateTextError,
  rejectEmptyGenerateText,
  extractChatCompletionText,
} = require('../../providers/errors');

describe('providers/errors', () => {
  describe('extractMessage', () => {
    it('parses OpenAI-style error objects', () => {
      const json = { error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } };
      assert.equal(extractMessage('openai', json), 'Incorrect API key provided');
    });

    it('parses Anthropic error objects', () => {
      const json = { error: { type: 'authentication_error', message: 'invalid x-api-key' } };
      assert.equal(extractMessage('anthropic', json), 'invalid x-api-key');
    });

    it('parses Gemini error objects', () => {
      const json = { error: { status: 'PERMISSION_DENIED', message: 'API key not valid' } };
      assert.equal(extractMessage('gemini', json), 'API key not valid');
    });

    it('parses MiniMax base_resp errors', () => {
      const json = { base_resp: { status_code: 1004, status_msg: 'login fail' } };
      assert.equal(extractMessage('minimax', json), 'login fail');
    });
  });

  describe('formatHttpError', () => {
    it('returns parsed provider message for 401', () => {
      const body = JSON.stringify({ error: { message: 'Incorrect API key provided' } });
      const msg = formatHttpError(401, body, 'openai');
      assert.match(msg, /Incorrect API key provided/);
      assert.match(msg, /\[openai\]/);
      assert.match(msg, /HTTP 401/);
    });

    it('returns Spanish hint when body is not JSON', () => {
      const msg = formatHttpError(429, 'rate limit exceeded', 'groq');
      assert.equal(msg, '[groq] HTTP 429: Límite de tasa alcanzado. Espera un momento e intenta de nuevo.');
    });

    it('returns hint for unknown status without parseable body', () => {
      const msg = formatHttpError(404, '', 'anthropic');
      assert.equal(msg, '[anthropic] HTTP 404: Modelo o recurso no encontrado. Prueba otro modelo.');
    });

    it('truncates long non-JSON bodies', () => {
      const body = 'x'.repeat(300);
      const msg = formatHttpError(418, body, 'mistral');
      assert.ok(msg.length < 250);
      assert.match(msg, /\[mistral\] HTTP 418:/);
      assert.match(msg, /…$/);
    });

    it('works without provider id', () => {
      const body = JSON.stringify({ error: { message: 'Model not found' } });
      const msg = formatHttpError(404, body);
      assert.equal(msg, 'HTTP 404: Model not found');
    });
  });

  describe('extractChatCompletionText', () => {
    it('returns strings unchanged', () => {
      assert.equal(extractChatCompletionText('hola'), 'hola');
      assert.equal(extractChatCompletionText(''), '');
    });

    it('joins text parts from content arrays', () => {
      assert.equal(
        extractChatCompletionText([
          { type: 'text', text: 'hola ' },
          { type: 'text', text: 'mundo' },
        ]),
        'hola mundo',
      );
    });

    it('supports string parts and part.content', () => {
      assert.equal(extractChatCompletionText(['a', { content: 'b' }]), 'ab');
    });

    it('returns empty string for null, objects, or empty arrays', () => {
      assert.equal(extractChatCompletionText(null), '');
      assert.equal(extractChatCompletionText(undefined), '');
      assert.equal(extractChatCompletionText({ text: 'x' }), '');
      assert.equal(extractChatCompletionText([]), '');
      assert.equal(extractChatCompletionText([{ type: 'image_url', image_url: {} }]), '');
    });
  });

  describe('rejectEmptyGenerateText', () => {
    it('returns null when text has content', () => {
      assert.equal(rejectEmptyGenerateText('hola'), null);
      assert.equal(rejectEmptyGenerateText('  ok  '), null);
    });

    it('rejects empty or whitespace-only text', () => {
      assert.deepEqual(rejectEmptyGenerateText('', { providerId: 'openai' }), {
        ok: false,
        error: 'openai no devolvió texto en la respuesta.',
      });
      assert.deepEqual(rejectEmptyGenerateText('   ', { providerId: 'groq', finishReason: 'length' }), {
        ok: false,
        error: 'groq no devolvió texto (finishReason: length).',
      });
    });

    it('emptyGenerateTextError falls back without provider id', () => {
      assert.equal(emptyGenerateTextError(), 'El proveedor no devolvió texto en la respuesta.');
    });

    it('rejects array content that stringifies to [object Object] without extraction', () => {
      // Regression guard: String([{ text: 'x' }]) === '[object Object]' which is non-empty.
      // Callers must extractChatCompletionText first; raw arrays still look "non-empty".
      const raw = [{ type: 'text', text: '' }];
      assert.equal(String(raw).trim(), '[object Object]');
      assert.equal(rejectEmptyGenerateText(raw), null);
      assert.deepEqual(rejectEmptyGenerateText(extractChatCompletionText(raw), { providerId: 'openai' }), {
        ok: false,
        error: 'openai no devolvió texto en la respuesta.',
      });
    });
  });
});
