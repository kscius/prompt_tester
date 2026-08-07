const { formatHttpError, rejectEmptyGenerateText, extractChatCompletionMessage } = require('./errors');
const { fetchWithTimeout, LIST_MODELS_TIMEOUT_MS, GENERATE_TIMEOUT_MS } = require('./http');

const BASE_URL = 'https://api.deepseek.com';

/** deepseek-chat / deepseek-reasoner: la API rechaza max_tokens > 8192. */
const DEEPSEEK_LEGACY_MAX_OUTPUT_TOKENS = 8_192;
/** V4 documenta hasta 384K de salida; 65535 es un tope práctico para el cliente. */
const DEEPSEEK_V4_MAX_OUTPUT_TOKENS = 65_535;

/**
 * @param {string} model
 * @returns {number}
 */
function getMaxOutputTokens(model) {
  const id = String(model ?? '').trim().toLowerCase();
  if (id === 'deepseek-chat' || id === 'deepseek-reasoner' || /^deepseek-chat/.test(id)) {
    return DEEPSEEK_LEGACY_MAX_OUTPUT_TOKENS;
  }
  if (/deepseek-v4|deepseek-v\d/i.test(id)) {
    return DEEPSEEK_V4_MAX_OUTPUT_TOKENS;
  }
  return DEEPSEEK_LEGACY_MAX_OUTPUT_TOKENS;
}

// deepseek-chat / deepseek-reasoner se deprecan el 2026-07-24; V4 Flash/Pro son los IDs actuales.
const fallbackModels = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
];

function isChatModel(id) {
  return /deepseek/i.test(id);
}

/** Alias legacy `deepseek-reasoner` (modo thinking de V4 Flash). */
function isThinkingModel(modelId) {
  const id = String(modelId ?? '').trim().toLowerCase();
  return id === 'deepseek-reasoner' || id.endsWith('-reasoner');
}

function buildChatCompletionBody({ model, messages, temperature }) {
  const body = {
    model,
    messages,
    max_tokens: getMaxOutputTokens(model),
  };
  // En thinking mode temperature/top_p no tienen efecto; omitirlos evita ruido y 400s legacy.
  if (!isThinkingModel(model)) {
    body.temperature = temperature ?? 1;
  }
  return body;
}

/** @deprecated Use extractChatCompletionMessage from ./errors */
function extractDeepSeekMessageText(message) {
  return extractChatCompletionMessage(message);
}

function isConfigured(ctx) {
  return Boolean(ctx.settings?.apiKey?.trim());
}

async function listModels(ctx) {
  const apiKey = ctx.settings?.apiKey?.trim();
  if (!apiKey) return fallbackModels;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }, {
      timeoutMs: LIST_MODELS_TIMEOUT_MS,
      providerId: 'deepseek',
      operation: 'listModels',
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(formatHttpError(res.status, errBody, 'deepseek'));
    }

    const json = await res.json();
    const models = (json.data ?? [])
      .map((m) => ({ id: m.id, label: m.id }))
      .filter((m) => isChatModel(m.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[deepseek] No se pudieron listar modelos:', e.message);
    throw e;
  }
}

function mapUsage(usage) {
  if (!usage) return null;
  return {
    promptTokenCount: usage.prompt_tokens ?? 0,
    candidatesTokenCount: usage.completion_tokens ?? 0,
    totalTokenCount: usage.total_tokens ?? 0,
  };
}

async function generate(ctx, { model, prompt, data, temperature }) {
  const apiKey = ctx.settings?.apiKey?.trim();
  const messages = [];
  if (prompt?.trim()) messages.push({ role: 'system', content: prompt });
  messages.push({ role: 'user', content: data || '' });
  const body = buildChatCompletionBody({ model, messages, temperature });

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, {
      timeoutMs: GENERATE_TIMEOUT_MS,
      providerId: 'deepseek',
      operation: 'generate',
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: formatHttpError(res.status, errBody, 'deepseek') };
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const text = extractDeepSeekMessageText(choice?.message);
    const finishReason = choice?.finish_reason ?? null;
    const empty = rejectEmptyGenerateText(text, { providerId: 'deepseek', finishReason });
    if (empty) return empty;
    return {
      ok: true,
      text,
      finishReason,
      usage: mapUsage(json.usage),
      cost: null,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  id: 'deepseek',
  label: 'DeepSeek',
  authType: 'apiKey',
  fallbackModels,
  DEEPSEEK_LEGACY_MAX_OUTPUT_TOKENS,
  DEEPSEEK_V4_MAX_OUTPUT_TOKENS,
  getMaxOutputTokens,
  isConfigured,
  isThinkingModel,
  buildChatCompletionBody,
  extractDeepSeekMessageText,
  listModels,
  generate,
};
