const BASE_URL = 'https://api.deepseek.com';

const fallbackModels = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
];

function isChatModel(id) {
  return /deepseek/i.test(id);
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
    if (!res.ok) return fallbackModels;

    const json = await res.json();
    const models = (json.data ?? [])
      .map((m) => ({ id: m.id, label: m.id }))
      .filter((m) => isChatModel(m.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[deepseek] No se pudieron listar modelos:', e.message);
    return fallbackModels;
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
      return { ok: false, error: `HTTP ${res.status}: ${errBody}` };
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
  id: 'deepseek',
  label: 'DeepSeek',
  authType: 'apiKey',
  fallbackModels,
  isConfigured,
  listModels,
  generate,
};
