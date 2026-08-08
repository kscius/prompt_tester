const { formatHttpError, rejectEmptyGenerateText } = require('./errors');
const { fetchWithTimeout, LIST_MODELS_TIMEOUT_MS, GENERATE_TIMEOUT_MS, parseJsonResponse } = require('./http');

const BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

/** Anthropic rechaza max_tokens por encima del límite de salida de cada modelo. */
const ANTHROPIC_MAX_OUTPUT_TOKENS = {
  opus3: 4_096,
  sonnet35: 8_192,
  extended: 64_000,
};

/**
 * @param {string} model
 * @returns {number}
 */
function getMaxOutputTokens(model) {
  const id = String(model || '').toLowerCase();
  if (/claude-3-opus|claude-opus-3/.test(id)) return ANTHROPIC_MAX_OUTPUT_TOKENS.opus3;
  if (/claude-3-5-(sonnet|haiku)/.test(id)) return ANTHROPIC_MAX_OUTPUT_TOKENS.sonnet35;
  if (/claude-(sonnet|opus)-4|claude-3-7-sonnet/.test(id)) return ANTHROPIC_MAX_OUTPUT_TOKENS.extended;
  return ANTHROPIC_MAX_OUTPUT_TOKENS.sonnet35;
}

const fallbackModels = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
];

function authHeaders(apiKey) {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };
}

function isConfigured(ctx) {
  return Boolean(ctx.settings?.apiKey?.trim());
}

async function listModels(ctx) {
  const apiKey = ctx.settings?.apiKey?.trim();
  if (!apiKey) return fallbackModels;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/models`, {
      headers: authHeaders(apiKey),
    }, {
      timeoutMs: LIST_MODELS_TIMEOUT_MS,
      providerId: 'anthropic',
      operation: 'listModels',
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(formatHttpError(res.status, errBody, 'anthropic'));
    }

    const json = await parseJsonResponse(res, { providerId: 'anthropic' });
    const models = (json.data ?? [])
      .map((m) => ({
        id: m.id,
        label: (m.display_name || m.id).trim(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[anthropic] No se pudieron listar modelos:', e.message);
    throw e;
  }
}

function mapUsage(usage) {
  if (!usage) return null;
  const promptTokenCount = usage.input_tokens ?? 0;
  const candidatesTokenCount = usage.output_tokens ?? 0;
  return {
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount: promptTokenCount + candidatesTokenCount,
  };
}

async function generate(ctx, { model, prompt, data, temperature }) {
  const apiKey = ctx.settings?.apiKey?.trim();

  const body = {
    model,
    max_tokens: getMaxOutputTokens(model),
    messages: [{ role: 'user', content: data || '' }],
    temperature: temperature ?? 1,
  };
  if (prompt?.trim()) body.system = prompt;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(apiKey),
      },
      body: JSON.stringify(body),
    }, {
      timeoutMs: GENERATE_TIMEOUT_MS,
      providerId: 'anthropic',
      operation: 'generate',
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: formatHttpError(res.status, errBody, 'anthropic') };
    }

    const json = await parseJsonResponse(res, { providerId: 'anthropic' });
    const text = (json.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text || '')
      .join('');
    const finishReason = json.stop_reason ?? null;
    const empty = rejectEmptyGenerateText(text, { providerId: 'anthropic', finishReason });
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
  id: 'anthropic',
  label: 'Anthropic',
  authType: 'apiKey',
  ANTHROPIC_MAX_OUTPUT_TOKENS,
  fallbackModels,
  getMaxOutputTokens,
  isConfigured,
  listModels,
  generate,
};
