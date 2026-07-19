const { formatHttpError, rejectEmptyGenerateText, extractChatCompletionText } = require('./errors');
const { fetchWithTimeout, LIST_MODELS_TIMEOUT_MS, GENERATE_TIMEOUT_MS } = require('./http');

const BASE_URL = 'https://api.openai.com/v1';

const fallbackModels = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { id: 'o1', label: 'o1' },
  { id: 'o3-mini', label: 'o3-mini' },
];

function isChatModel(id) {
  return /^(gpt-|chatgpt-|o[1349]|text-davinci)/i.test(id) || /\bgpt-/i.test(id);
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
      providerId: 'openai',
      operation: 'listModels',
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(formatHttpError(res.status, errBody, 'openai'));
    }

    const json = await res.json();
    const models = (json.data ?? [])
      .map((m) => ({ id: m.id, label: m.id }))
      .filter((m) => isChatModel(m.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[openai] No se pudieron listar modelos:', e.message);
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

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 1,
        max_tokens: 65535,
      }),
    }, {
      timeoutMs: GENERATE_TIMEOUT_MS,
      providerId: 'openai',
      operation: 'generate',
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: formatHttpError(res.status, errBody, 'openai') };
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const text = extractChatCompletionText(choice?.message?.content);
    const finishReason = choice?.finish_reason ?? null;
    const empty = rejectEmptyGenerateText(text, { providerId: 'openai', finishReason });
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
  id: 'openai',
  label: 'OpenAI',
  authType: 'apiKey',
  fallbackModels,
  isConfigured,
  listModels,
  generate,
};
