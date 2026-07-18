const { formatHttpError, rejectEmptyGenerateText, extractChatCompletionText } = require('./errors');

const BASE_URL = 'https://api.minimax.chat/v1';

const fallbackModels = [
  { id: 'abab6.5s-chat', label: 'abab6.5s-chat' },
  { id: 'abab6.5g-chat', label: 'abab6.5g-chat' },
  { id: 'MiniMax-Text-01', label: 'MiniMax-Text-01' },
];

function authHeaders(ctx) {
  const headers = {
    Authorization: `Bearer ${ctx.settings?.apiKey?.trim()}`,
    'Content-Type': 'application/json',
  };
  const groupId = ctx.settings?.groupId?.trim();
  if (groupId) headers['Group-Id'] = groupId;
  return headers;
}

function isConfigured(ctx) {
  return Boolean(ctx.settings?.apiKey?.trim());
}

async function listModels(ctx) {
  const apiKey = ctx.settings?.apiKey?.trim();
  if (!apiKey) return fallbackModels;

  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: authHeaders(ctx),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(formatHttpError(res.status, errBody, 'minimax'));
    }

    const json = await res.json();
    if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
      throw new Error(json.base_resp.status_msg || `MiniMax error ${json.base_resp.status_code}`);
    }

    const raw = json.data ?? json.models ?? [];
    const items = Array.isArray(raw) ? raw : [];

    const models = items
      .map((m) => {
        const id = m.id ?? m.model_name ?? m.name;
        if (!id) return null;
        return { id, label: (m.display_name || m.label || id).trim() };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[minimax] No se pudieron listar modelos:', e.message);
    throw e;
  }
}

function mapUsage(usage) {
  if (!usage) return null;
  const promptTokenCount = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const candidatesTokenCount = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokenCount = usage.total_tokens ?? promptTokenCount + candidatesTokenCount;
  return { promptTokenCount, candidatesTokenCount, totalTokenCount };
}

async function generate(ctx, { model, prompt, data, temperature }) {
  const messages = [];
  if (prompt?.trim()) messages.push({ role: 'system', content: prompt });
  messages.push({ role: 'user', content: data || '' });

  const body = {
    model,
    messages,
    temperature: temperature ?? 1,
    max_tokens: 65535,
  };

  const groupId = ctx.settings?.groupId?.trim();
  if (groupId) body.group_id = groupId;

  try {
    const res = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: authHeaders(ctx),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: formatHttpError(res.status, errBody, 'minimax') };
    }

    const json = await res.json();
    if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
      return {
        ok: false,
        error: json.base_resp.status_msg || `MiniMax error ${json.base_resp.status_code}`,
      };
    }

    const choice = json.choices?.[0];
    const rawContent = choice?.message?.content ?? choice?.text ?? json.reply ?? '';
    const text = extractChatCompletionText(rawContent);
    const finishReason = choice?.finish_reason ?? json.finish_reason ?? null;
    const empty = rejectEmptyGenerateText(text, { providerId: 'minimax', finishReason });
    if (empty) return empty;
    const usage = mapUsage(json.usage ?? choice?.usage);

    return {
      ok: true,
      text,
      finishReason,
      usage,
      cost: null,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  id: 'minimax',
  label: 'MiniMax',
  authType: 'apiKey',
  optionalFields: [{ key: 'groupId', label: 'Group ID' }],
  fallbackModels,
  isConfigured,
  listModels,
  generate,
};
