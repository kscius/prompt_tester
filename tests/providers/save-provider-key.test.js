const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildProviderApiKeySettings,
  saveProviderApiKey,
} = require('../../providers/save-provider-key');

describe('providers/save-provider-key', () => {
  describe('buildProviderApiKeySettings', () => {
    it('rejects empty API keys', () => {
      assert.deepEqual(buildProviderApiKeySettings('openai', '  '), {
        ok: false,
        error: 'API key vacía',
      });
    });

    it('sets authMode apiKey for gemini', () => {
      const result = buildProviderApiKeySettings('gemini', 'AIza-test-key');
      assert.equal(result.ok, true);
      assert.deepEqual(result.settings, { apiKey: 'AIza-test-key', authMode: 'apiKey' });
    });

    it('clears MiniMax groupId when payload sends empty string', () => {
      const result = buildProviderApiKeySettings('minimax', 'mm-key', '');
      assert.equal(result.ok, true);
      assert.deepEqual(result.settings, { apiKey: 'mm-key', groupId: null });
    });
  });

  describe('saveProviderApiKey', () => {
    it('does not remove Gemini SA when setProviderSettings throws', () => {
      let cleared = false;
      assert.throws(
        () =>
          saveProviderApiKey({
            providerId: 'gemini',
            apiKey: 'AIza-new-key',
            setProviderSettings: () => {
              throw new Error('No se puede guardar: config dañada');
            },
            clearGeminiServiceAccount: () => {
              cleared = true;
            },
          }),
        /config dañada/
      );
      assert.equal(cleared, false);
    });

    it('removes Gemini SA only after settings persist', () => {
      const calls = [];
      const result = saveProviderApiKey({
        providerId: 'gemini',
        apiKey: 'AIza-new-key',
        setProviderSettings: (id, settings) => {
          calls.push(['set', id, settings]);
        },
        clearGeminiServiceAccount: () => {
          calls.push(['clear']);
        },
      });
      assert.equal(result.ok, true);
      assert.deepEqual(calls, [
        ['set', 'gemini', { apiKey: 'AIza-new-key', authMode: 'apiKey' }],
        ['clear'],
      ]);
    });

    it('does not call clearGeminiServiceAccount for non-gemini providers', () => {
      let cleared = false;
      const result = saveProviderApiKey({
        providerId: 'openai',
        apiKey: 'sk-test-key-12345678',
        setProviderSettings: () => {},
        clearGeminiServiceAccount: () => {
          cleared = true;
        },
      });
      assert.equal(result.ok, true);
      assert.equal(cleared, false);
    });
  });
});
