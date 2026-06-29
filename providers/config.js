const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILENAME = 'provider-config.json';

const DEFAULT_CONFIG = {
  activeProvider: 'gemini',
  providers: {},
};

function getProviderConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function readProviderConfig() {
  try {
    const filePath = getProviderConfigPath();
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        ...DEFAULT_CONFIG,
        ...raw,
        providers: { ...DEFAULT_CONFIG.providers, ...(raw.providers ?? {}) },
      };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function writeProviderConfig(config) {
  fs.writeFileSync(getProviderConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function getProviderSettings(providerId) {
  const config = readProviderConfig();
  return config.providers[providerId] ?? {};
}

function setProviderSettings(providerId, settings) {
  const config = readProviderConfig();
  config.providers[providerId] = { ...(config.providers[providerId] ?? {}), ...settings };
  writeProviderConfig(config);
  return config.providers[providerId];
}

function getActiveProviderId() {
  return readProviderConfig().activeProvider ?? 'gemini';
}

function setActiveProviderId(providerId) {
  const config = readProviderConfig();
  config.activeProvider = providerId;
  writeProviderConfig(config);
}

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

module.exports = {
  getProviderConfigPath,
  readProviderConfig,
  writeProviderConfig,
  getProviderSettings,
  setProviderSettings,
  getActiveProviderId,
  setActiveProviderId,
  maskApiKey,
};
