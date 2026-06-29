const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatHttpError, extractMessage } = require('../../providers/errors');

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
});
