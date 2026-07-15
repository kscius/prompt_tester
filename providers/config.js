const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILENAME = 'provider-config.json';

const DEFAULT_CONFIG = {
  activeProvider: 'gemini',
  providers: {},
};

let providerConfigReadFailed = false;

function getProviderConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function readProviderConfig() {
  providerConfigReadFailed = false;
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
  } catch (e) {
    providerConfigReadFailed = true;
    console.error('[config] No se pudo leer provider-config.json:', e.message);
  }
  // Deep-copy providers so callers never mutate the shared DEFAULT_CONFIG.
  return { ...DEFAULT_CONFIG, providers: { ...DEFAULT_CONFIG.providers } };
}

function writeProviderConfig(config) {
  if (providerConfigReadFailed) {
    const err = new Error(
      'No se puede guardar: provider-config.json está dañado. Renómbralo o corrígelo manualmente.',
    );
    err.code = 'CONFIG_READ_FAILED';
    throw err;
  }
  try {
    fs.writeFileSync(getProviderConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    const err = new Error(`No se pudo guardar la configuración de proveedores: ${e.message}`);
    err.cause = e;
    throw err;
  }
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

/** Replace (do not merge) provider settings — used by clear flows. */
function clearProviderSettings(providerId) {
  const config = readProviderConfig();
  delete config.providers[providerId];
  writeProviderConfig(config);
  return {};
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
  clearProviderSettings,
  getActiveProviderId,
  setActiveProviderId,
  maskApiKey,
  isProviderConfigReadFailed: () => providerConfigReadFailed,
};
