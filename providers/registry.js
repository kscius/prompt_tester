const { getProviderSettings } = require('./config');
const openai = require('./openai');
const anthropic = require('./anthropic');
const gemini = require('./gemini');
const minimax = require('./minimax');
const mistral = require('./mistral');
const groq = require('./groq');
const deepseek = require('./deepseek');

const PROVIDERS = [
  openai,
  anthropic,
  gemini,
  minimax,
  mistral,
  groq,
  deepseek,
];

const PROVIDER_IDS = PROVIDERS.map((p) => p.id);
const providerById = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

/** @type {Map<string, { cacheKey: string, models: Array<{ id: string, label: string }> }>} */
const modelsCache = new Map();

function buildProviderCtx(providerId, getDataPath, readJSON, fileExists) {
  return {
    settings: getProviderSettings(providerId),
    getDataPath,
    readJSON,
    fileExists,
  };
}

function buildModelsCacheKey(provider, ctx) {
  if (typeof provider.getModelsCacheKey === 'function') {
    return provider.getModelsCacheKey(ctx);
  }
  const apiKey = ctx.settings?.apiKey?.trim() ?? '';
  const groupId = ctx.settings?.groupId?.trim() ?? '';
  return `${apiKey.slice(0, 8)}:${groupId}`;
}

function getProvider(id) {
  return providerById[id] ?? null;
}

function listProviderMeta() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    authType: p.authType,
    optionalFields: p.optionalFields,
    fallbackModels: p.fallbackModels,
  }));
}

function invalidateModelsCache(providerId) {
  if (providerId) {
    modelsCache.delete(providerId);
    return;
  }
  modelsCache.clear();
}

async function listModelsForProvider(providerId, getDataPath, readJSON, fileExists) {
  const provider = getProvider(providerId);
  if (!provider) return { models: [], warning: null };

  const ctx = buildProviderCtx(providerId, getDataPath, readJSON, fileExists);

  if (typeof provider.getConfigurationError === 'function') {
    const configError = provider.getConfigurationError(ctx);
    if (configError) {
      return {
        models: provider.fallbackModels ?? [],
        warning: configError,
      };
    }
  }

  if (!provider.isConfigured(ctx)) {
    return {
      models: provider.fallbackModels ?? [],
      warning: `${provider.label} no está configurado. Configura las credenciales en «Proveedores y API Keys».`,
    };
  }

  const cacheKey = buildModelsCacheKey(provider, ctx);
  const cached = modelsCache.get(providerId);
  if (cached && cached.cacheKey === cacheKey) {
    return { models: cached.models, warning: null };
  }

  try {
    const models = await provider.listModels(ctx);
    modelsCache.set(providerId, { cacheKey, models });
    return { models, warning: null };
  } catch (e) {
    const message = e?.message || 'No se pudieron listar modelos desde la API.';
    console.warn(`[registry] listModels falló para ${providerId}:`, message);
    return {
      models: provider.fallbackModels ?? [],
      warning: message,
    };
  }
}

async function callProvider(providerId, args, getDataPath, readJSON, fileExists) {
  const provider = getProvider(providerId);
  if (!provider) {
    return { ok: false, error: `Proveedor desconocido: ${providerId}` };
  }

  const ctx = buildProviderCtx(providerId, getDataPath, readJSON, fileExists);
  if (typeof provider.getConfigurationError === 'function') {
    const configError = provider.getConfigurationError(ctx);
    if (configError) {
      return { ok: false, error: configError };
    }
  }
  if (!provider.isConfigured(ctx)) {
    return { ok: false, error: 'Proveedor no configurado.' };
  }

  return provider.generate(ctx, args);
}

module.exports = {
  PROVIDER_IDS,
  getProvider,
  listProviderMeta,
  invalidateModelsCache,
  listModelsForProvider,
  callProvider,
};
