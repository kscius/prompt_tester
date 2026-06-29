const path = require('path');
const fs = require('fs');

const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const CACHE_FILENAME = 'pricing-cache.json';
const REFRESH_TIMEOUT_MS = 12_000;

/** @type {Map<string, string>} LiteLLM provider id → app provider id */
const LITELLM_PROVIDER_MAP = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'gemini',
  vertex_ai: 'gemini',
  minimax: 'minimax',
  mistral: 'mistral',
  groq: 'groq',
  deepseek: 'deepseek',
};

let pricingState = null;
let dataPathFn = null;
let readJSONFn = null;
let writeJSONFn = null;

function loadBundledDefaults() {
  const bundledPath = path.join(__dirname, '..', 'pricing', 'pricing-defaults.json');
  try {
    return JSON.parse(fs.readFileSync(bundledPath, 'utf-8'));
  } catch (e) {
    console.warn('[pricing] No se pudieron cargar defaults embebidos:', e.message);
    return { version: 1, source: 'bundled', providers: {} };
  }
}

function perTokenToPerM(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return value * 1_000_000;
}

function stripProviderPrefix(litellmKey, litellmProvider) {
  const prefixes = [
    `${litellmProvider}/`,
    'gemini/',
    'groq/',
    'mistral/',
    'minimax/',
    'openai/',
    'anthropic/',
    'deepseek/',
  ];
  let id = litellmKey;
  for (const prefix of prefixes) {
    if (id.startsWith(prefix)) {
      id = id.slice(prefix.length);
      break;
    }
  }
  if (litellmProvider === 'gemini' && id.startsWith('gemini-')) {
    return id;
  }
  return id;
}

function normalizeLiteLLMCatalog(raw) {
  const providers = {};

  for (const [litellmKey, entry] of Object.entries(raw)) {
    const litellmProvider = entry?.litellm_provider;
    const appProvider = LITELLM_PROVIDER_MAP[litellmProvider];
    if (!appProvider) continue;

    const inputPerM = perTokenToPerM(entry.input_cost_per_token);
    const outputPerM = perTokenToPerM(entry.output_cost_per_token);
    if (inputPerM == null && outputPerM == null) continue;

    const modelId = stripProviderPrefix(litellmKey, litellmProvider);
    if (!modelId) continue;

    if (!providers[appProvider]) providers[appProvider] = {};

    const rate = {
      inputPerM: inputPerM ?? 0,
      outputPerM: outputPerM ?? 0,
      source: 'litellm',
      litellmKey,
    };

    providers[appProvider][modelId] = rate;
    providers[appProvider][litellmKey] = rate;
  }

  return providers;
}

function mergeProviderRates(bundled, remote) {
  const merged = {};
  const providerIds = new Set([
    ...Object.keys(bundled?.providers ?? {}),
    ...Object.keys(remote ?? {}),
  ]);

  for (const providerId of providerIds) {
    merged[providerId] = {
      ...(bundled?.providers?.[providerId] ?? {}),
      ...(remote?.[providerId] ?? {}),
    };
  }
  return merged;
}

function buildState({ providers, source, fetchedAt, error }) {
  return {
    version: 1,
    source,
    fetchedAt,
    error: error ?? null,
    providers,
  };
}

function loadCacheFromDisk() {
  if (!dataPathFn || !readJSONFn) return null;
  const cached = readJSONFn(dataPathFn(CACHE_FILENAME));
  if (!cached?.providers) return null;
  return cached;
}

function persistCache(state) {
  if (!dataPathFn || !writeJSONFn) return;
  try {
    writeJSONFn(dataPathFn(CACHE_FILENAME), state);
  } catch (e) {
    console.warn('[pricing] No se pudo guardar caché de precios:', e.message);
  }
}

function initPricing({ getDataPath, readJSON, writeJSON }) {
  dataPathFn = getDataPath;
  readJSONFn = readJSON;
  writeJSONFn = writeJSON;

  const bundled = loadBundledDefaults();
  const disk = loadCacheFromDisk();

  if (disk?.providers) {
    pricingState = buildState({
      providers: mergeProviderRates(bundled, disk.providers),
      source: disk.source ?? 'cache',
      fetchedAt: disk.fetchedAt ?? null,
    });
  } else {
    pricingState = buildState({
      providers: mergeProviderRates(bundled, {}),
      source: 'bundled',
      fetchedAt: null,
    });
  }
}

async function fetchLiteLLMPricing() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  try {
    const res = await fetch(LITELLM_PRICING_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return normalizeLiteLLMCatalog(raw);
  } finally {
    clearTimeout(timer);
  }
}

async function refreshPricingOnOpen() {
  const bundled = loadBundledDefaults();
  const previous = pricingState;

  try {
    const remote = await fetchLiteLLMPricing();
    const fetchedAt = new Date().toISOString();
    const providers = mergeProviderRates(bundled, remote);

    pricingState = buildState({
      providers,
      source: 'litellm',
      fetchedAt,
    });
    persistCache(pricingState);
    console.info('[pricing] Precios actualizados desde LiteLLM:', fetchedAt);
    return { ok: true, ...getPricingStatus() };
  } catch (e) {
    console.warn('[pricing] No se pudieron actualizar precios del día:', e.message);
    if (!pricingState) {
      pricingState = buildState({
        providers: mergeProviderRates(bundled, {}),
        source: 'bundled',
        fetchedAt: null,
        error: e.message,
      });
    } else if (previous) {
      pricingState = {
        ...previous,
        error: e.message,
      };
    }
    return { ok: false, error: e.message, ...getPricingStatus() };
  }
}

function normalizeModelId(modelId) {
  return (modelId ?? '').trim().toLowerCase();
}

function findModelRate(providerId, modelId) {
  if (!pricingState?.providers) return null;
  const prov = pricingState.providers[providerId];
  if (!prov || !modelId) return null;

  const id = modelId.trim();
  const idLower = normalizeModelId(id);

  const direct = prov[id] ?? prov[idLower];
  if (direct) return direct;

  const prefixed = [
    `${providerId}/${id}`,
    `gemini/${id}`,
    `groq/${id}`,
    `mistral/${id}`,
    `minimax/${id}`,
    `openai/${id}`,
    `anthropic/${id}`,
    `deepseek/${id}`,
  ];
  for (const key of prefixed) {
    if (prov[key]) return prov[key];
  }

  const keys = Object.keys(prov);
  let best = null;
  let bestLen = 0;
  for (const key of keys) {
    const keyLower = key.toLowerCase();
    if (keyLower === idLower) return prov[key];
    if (idLower.startsWith(keyLower) || keyLower.startsWith(idLower)) {
      const len = Math.min(keyLower.length, idLower.length);
      if (len > bestLen) {
        bestLen = len;
        best = prov[key];
      }
    }
  }
  return best;
}

function calcCost(providerId, modelId, promptTokens, candidateTokens) {
  if (!promptTokens && !candidateTokens) return null;

  const rate = findModelRate(providerId, modelId);
  if (!rate) return null;

  const inputPerM = rate.inputPerM ?? 0;
  const outputPerM = rate.outputPerM ?? 0;

  return ((promptTokens ?? 0) / 1_000_000) * inputPerM
       + ((candidateTokens ?? 0) / 1_000_000) * outputPerM;
}

function getPricingStatus() {
  const state = pricingState ?? buildState({ providers: {}, source: 'bundled', fetchedAt: null });
  const providerStats = {};
  for (const [providerId, models] of Object.entries(state.providers ?? {})) {
    providerStats[providerId] = Object.keys(models).length;
  }
  return {
    source: state.source,
    fetchedAt: state.fetchedAt,
    error: state.error ?? null,
    modelCount: Object.values(providerStats).reduce((a, b) => a + b, 0),
    providers: providerStats,
  };
}

module.exports = {
  initPricing,
  refreshPricingOnOpen,
  calcCost,
  findModelRate,
  getPricingStatus,
};
