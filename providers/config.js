const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILENAME = 'provider-config.json';

const CONFIG_CORRUPT_ERROR =
  'provider-config.json está dañado. Renómbralo o corrígelo manualmente.';

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
  return { ...DEFAULT_CONFIG };
}

function getProviderConfigHealth() {
  readProviderConfig();
  if (!providerConfigReadFailed) return { ok: true };
  return { ok: false, corrupt: true, error: CONFIG_CORRUPT_ERROR };
}

function writeProviderConfig(config) {
  if (providerConfigReadFailed) {
    const err = new Error(`No se puede guardar: ${CONFIG_CORRUPT_ERROR}`);
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
  getProviderConfigHealth,
  getProviderSettings,
  setProviderSettings,
  getActiveProviderId,
  setActiveProviderId,
  maskApiKey,
  isProviderConfigReadFailed: () => providerConfigReadFailed,
  CONFIG_CORRUPT_ERROR,
};
