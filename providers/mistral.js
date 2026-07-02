const { formatHttpError } = require('./errors');

const BASE_URL = 'https://api.mistral.ai/v1';

const fallbackModels = [
  { id: 'mistral-large-latest', label: 'Mistral Large' },
  { id: 'mistral-small-latest', label: 'Mistral Small' },
  { id: 'codestral-latest', label: 'Codestral' },
  { id: 'open-mistral-nemo', label: 'Open Mistral Nemo' },
];

function isChatModel(id) {
  return !/embed|moderation|ocr|pixtral-12b-2409/i.test(id);
}

function isConfigured(ctx) {
  return Boolean(ctx.settings?.apiKey?.trim());
}

async function listModels(ctx) {
  const apiKey = ctx.settings?.apiKey?.trim();
  if (!apiKey) return fallbackModels;

  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(formatHttpError(res.status, errBody, 'mistral'));
    }

    const json = await res.json();
    const models = (json.data ?? [])
      .map((m) => ({
        id: m.id,
        label: (m.name || m.id).trim(),
      }))
      .filter((m) => isChatModel(m.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[mistral] No se pudieron listar modelos:', e.message);
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
    const res = await fetch(`${BASE_URL}/chat/completions`, {
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
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: formatHttpError(res.status, errBody, 'mistral') };
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    return {
      ok: true,
      text: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason ?? null,
      usage: mapUsage(json.usage),
      cost: null,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  id: 'mistral',
  label: 'Mistral',
  authType: 'apiKey',
  fallbackModels,
  isConfigured,
  listModels,
  generate,
};
