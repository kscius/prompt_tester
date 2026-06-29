const BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

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
    const res = await fetch(`${BASE_URL}/models`, {
      headers: authHeaders(apiKey),
    });
    if (!res.ok) return fallbackModels;

    const json = await res.json();
    const models = (json.data ?? [])
      .map((m) => ({
        id: m.id,
        label: (m.display_name || m.id).trim(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[anthropic] No se pudieron listar modelos:', e.message);
    return fallbackModels;
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
    max_tokens: 65535,
    messages: [{ role: 'user', content: data || '' }],
    temperature: temperature ?? 1,
  };
  if (prompt?.trim()) body.system = prompt;

  try {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(apiKey),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errBody}` };
    }

    const json = await res.json();
    const text = (json.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text || '')
      .join('');

    return {
      ok: true,
      text,
      finishReason: json.stop_reason ?? null,
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
  fallbackModels,
  isConfigured,
  listModels,
  generate,
};
