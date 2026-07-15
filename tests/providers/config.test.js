const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

let tmpDir;
let config;

function loadConfigModule() {
  delete require.cache[require.resolve('electron')];
  delete require.cache[require.resolve('../../providers/config')];
  require.cache[require.resolve('electron')] = {
    exports: { app: { getPath: () => tmpDir } },
  };
  return require('../../providers/config');
}

describe('providers/config', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-config-'));
    config = loadConfigModule();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete require.cache[require.resolve('electron')];
    delete require.cache[require.resolve('../../providers/config')];
  });

  describe('maskApiKey', () => {
    it('masks long keys showing first and last four characters', () => {
      assert.equal(config.maskApiKey('sk-abcdefghijklmnop'), 'sk-a••••mnop');
    });

    it('returns bullets for short keys', () => {
      assert.equal(config.maskApiKey('short'), '••••••••');
    });

    it('returns empty string for null or non-string input', () => {
      assert.equal(config.maskApiKey(null), '');
      assert.equal(config.maskApiKey(123), '');
      assert.equal(config.maskApiKey(''), '');
    });
  });

  describe('readProviderConfig / writeProviderConfig', () => {
    it('merges defaults and persists provider settings', () => {
      config.setProviderSettings('groq', { apiKey: 'gk-test-key-12345' });
      assert.equal(config.getProviderSettings('groq').apiKey, 'gk-test-key-12345');
      assert.equal(config.getActiveProviderId(), 'gemini');
    });

    it('blocks writes when provider-config.json is corrupt', () => {
      const configPath = config.getProviderConfigPath();
      fs.writeFileSync(configPath, '{ not valid json', 'utf-8');

      config.readProviderConfig();
      assert.equal(config.isProviderConfigReadFailed(), true);

      assert.throws(
        () => config.setActiveProviderId('openai'),
        (err) => err.code === 'CONFIG_READ_FAILED',
      );
    });

    it('allows writes after a successful read of valid config', () => {
      config.setProviderSettings('openai', { apiKey: 'sk-valid-key-12345678' });
      config.setActiveProviderId('openai');
      assert.equal(config.getActiveProviderId(), 'openai');
      assert.equal(config.isProviderConfigReadFailed(), false);
    });
  });

  describe('clearProviderSettings', () => {
    it('removes apiKey and other settings instead of merging empty object', () => {
      config.setProviderSettings('minimax', {
        apiKey: 'mm-test-key-12345678',
        groupId: 'grp-old',
      });
      assert.equal(config.getProviderSettings('minimax').apiKey, 'mm-test-key-12345678');
      assert.equal(config.getProviderSettings('minimax').groupId, 'grp-old');

      // Regression: setProviderSettings(id, {}) used to be a no-op merge.
      config.setProviderSettings('minimax', {});
      assert.equal(config.getProviderSettings('minimax').apiKey, 'mm-test-key-12345678');
      assert.equal(config.getProviderSettings('minimax').groupId, 'grp-old');

      config.clearProviderSettings('minimax');
      assert.deepEqual(config.getProviderSettings('minimax'), {});
      assert.equal(config.getProviderSettings('minimax').apiKey, undefined);
      assert.equal(config.getProviderSettings('minimax').groupId, undefined);
    });

    it('blocks clear when provider-config.json is corrupt', () => {
      config.setProviderSettings('groq', { apiKey: 'gk-test-key-12345' });
      const configPath = config.getProviderConfigPath();
      fs.writeFileSync(configPath, '{ not valid json', 'utf-8');

      config.readProviderConfig();
      assert.equal(config.isProviderConfigReadFailed(), true);

      assert.throws(
        () => config.clearProviderSettings('groq'),
        (err) => err.code === 'CONFIG_READ_FAILED',
      );
    });
  });
});
