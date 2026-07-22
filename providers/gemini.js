const { formatHttpError } = require('./errors');
const { fetchWithTimeout, LIST_MODELS_TIMEOUT_MS, GENERATE_TIMEOUT_MS } = require('./http');
const { inspectCredentialsFile, CORRUPT_ERROR } = require('./credentials-store');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const fallbackModels = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (001)' },
  { id: 'gemini-2.0-flash-lite-001', label: 'Gemini 2.0 Flash Lite (001)' },
  { id: 'gemini-1.5-flash-002', label: 'Gemini 1.5 Flash (002)' },
  { id: 'gemini-1.5-pro-002', label: 'Gemini 1.5 Pro (002)' },
];

function usesApiKey(ctx) {
  const mode = ctx.settings?.authMode;
  if (mode === 'serviceAccount') return false;
  if (mode === 'apiKey') return true;
  return Boolean(ctx.settings?.apiKey?.trim());
}

function credentialsFileExists(ctx, filePath) {
  if (typeof ctx.fileExists === 'function') return Boolean(ctx.fileExists(filePath));
  return false;
}

function inspectServiceAccountCredentials(ctx) {
  const filePath = ctx.getDataPath('credentials.json');
  if (typeof ctx.fileExists === 'function') {
    return inspectCredentialsFile(ctx.readJSON, filePath, (p) => credentialsFileExists(ctx, p));
  }
  // Legacy ctx without fileExists cannot distinguish missing vs unreadable files.
  const raw = ctx.readJSON(filePath);
  if (raw === null) {
    return { ok: true, creds: null, corrupt: false };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, creds: null, corrupt: true, error: CORRUPT_ERROR };
  }
  return { ok: true, creds: raw, corrupt: false };
}

/** Prefer this over a generic "not configured" when credentials.json is unreadable. */
function getConfigurationError(ctx) {
  if (usesApiKey(ctx)) return null;
  const inspection = inspectServiceAccountCredentials(ctx);
  if (inspection.corrupt) return inspection.error ?? CORRUPT_ERROR;
  return null;
}

function isConfigured(ctx) {
  if (usesApiKey(ctx)) return Boolean(ctx.settings?.apiKey?.trim());
  const inspection = inspectServiceAccountCredentials(ctx);
  if (inspection.corrupt) return false;
  return Boolean(inspection.creds?.type === 'service_account');
}

async function getServiceAccountAccessToken(ctx) {
  try {
    const inspection = inspectServiceAccountCredentials(ctx);
    if (inspection.corrupt) {
      return { ok: false, error: inspection.error ?? CORRUPT_ERROR };
    }
    const creds = inspection.creds;
    if (!creds) {
      return { ok: false, error: 'Sin credenciales configuradas. Configúralas en el botón de credenciales.' };
    }

    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      credentials: creds,
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/generative-language',
      ],
    });

    const client = await auth.getClient();
    const tokenResult = await client.getAccessToken();
    const accessToken = tokenResult.token;
    if (!accessToken) {
      return { ok: false, error: 'No se pudo obtener el token de acceso.' };
    }

    return {
      ok: true,
      token: accessToken,
      cacheKey: creds.client_email ?? creds.project_id ?? 'default',
    };
  } catch (e) {
    console.warn('[gemini] Error obteniendo token de Service Account:', e.message);
    return { ok: false, error: e.message || 'No se pudo autenticar con Service Account.' };
  }
}

async function getApiKeyAuth(ctx) {
  const apiKey = ctx.settings?.apiKey?.trim();
  if (!apiKey) {
    return { ok: false, error: 'Sin API key de Gemini configurada.' };
  }
  return { ok: true, apiKey, cacheKey: `apiKey:${apiKey.slice(0, 8)}` };
}

async function resolveAuth(ctx) {
  if (usesApiKey(ctx)) return getApiKeyAuth(ctx);
  return getServiceAccountAccessToken(ctx);
}

function buildAuthHeaders(auth) {
  if (auth.apiKey) {
    return { 'x-goog-api-key': auth.apiKey };
  }
  return { Authorization: `Bearer ${auth.token}` };
}

function buildModelUrl(path, auth) {
  const url = new URL(`${BASE_URL}${path}`);
  if (auth.apiKey) url.searchParams.set('key', auth.apiKey);
  return url.toString();
}

async function fetchAllApiModels(auth) {
  const collected = [];
  let pageToken;

  do {
    const url = new URL(`${BASE_URL}/models`);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    if (auth.apiKey) url.searchParams.set('key', auth.apiKey);

    const res = await fetchWithTimeout(url.toString(), {
      headers: buildAuthHeaders(auth),
    }, {
      timeoutMs: LIST_MODELS_TIMEOUT_MS,
      providerId: 'gemini',
      operation: 'listModels',
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(formatHttpError(res.status, errBody, 'gemini'));
    }

    const json = await res.json();
    if (Array.isArray(json.models)) collected.push(...json.models);
    pageToken = json.nextPageToken;
  } while (pageToken);

  return collected;
}

function apiModelToOption(model) {
  const id = (model.name || '').replace(/^models\//, '');
  if (!id) return null;

  const methods = model.supportedGenerationMethods ?? [];
  if (!methods.includes('generateContent')) return null;

  return {
    id,
    label: (model.displayName || id).trim(),
  };
}

async function listModels(ctx) {
  const auth = await resolveAuth(ctx);
  if (!auth.ok) throw new Error(auth.error);

  try {
    const raw = await fetchAllApiModels(auth);
    const models = raw
      .map(apiModelToOption)
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

    return models.length > 0 ? models : fallbackModels;
  } catch (e) {
    console.warn('[gemini] No se pudieron listar modelos desde la API:', e.message);
    throw e;
  }
}

function mapUsage(usageMetadata) {
  if (!usageMetadata) return null;
  return {
    promptTokenCount: usageMetadata.promptTokenCount ?? 0,
    candidatesTokenCount: usageMetadata.candidatesTokenCount ?? 0,
    totalTokenCount: usageMetadata.totalTokenCount ?? 0,
  };
}

function extractCandidateText(candidate) {
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => p.text || '').join('');
}

function emptyGenerateError(json, finishReason) {
  const blockReason = json?.promptFeedback?.blockReason;
  if (blockReason) {
    return `Contenido bloqueado por Gemini (${blockReason}).`;
  }
  if (finishReason === 'SAFETY') {
    return 'Respuesta bloqueada por filtros de seguridad (SAFETY).';
  }
  if (finishReason === 'RECITATION') {
    return 'Respuesta bloqueada por Gemini (RECITATION).';
  }
  if (finishReason === 'MAX_TOKENS') {
    return 'Gemini alcanzó el límite de tokens sin devolver texto.';
  }
  if (!json?.candidates?.length) {
    return 'Gemini no devolvió candidatos.';
  }
  return finishReason
    ? `Gemini no devolvió texto (finishReason: ${finishReason}).`
    : 'Gemini no devolvió texto en la respuesta.';
}

async function generate(ctx, { model, prompt, data, temperature }) {
  const auth = await resolveAuth(ctx);
  if (!auth.ok) return { ok: false, error: auth.error };

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: data || '' }] }],
    generationConfig: { maxOutputTokens: 65535, temperature: temperature ?? 1, topP: 0.95 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
    ],
  };

  if (prompt?.trim()) {
    requestBody.systemInstruction = { parts: [{ text: prompt }] };
  }

  try {
    const res = await fetchWithTimeout(buildModelUrl(`/models/${model}:generateContent`, auth), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(auth),
      },
      body: JSON.stringify(requestBody),
    }, {
      timeoutMs: GENERATE_TIMEOUT_MS,
      providerId: 'gemini',
      operation: 'generate',
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: formatHttpError(res.status, errBody, 'gemini') };
    }

    const json = await res.json();
    if (json.promptFeedback?.blockReason) {
      return { ok: false, error: emptyGenerateError(json, null) };
    }

    const candidate = json.candidates?.[0];
    const finishReason = candidate?.finishReason ?? null;
    const text = extractCandidateText(candidate);

    if (!text.trim()) {
      return { ok: false, error: emptyGenerateError(json, finishReason) };
    }

    return {
      ok: true,
      text,
      finishReason,
      usage: mapUsage(json.usageMetadata),
      cost: null,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getModelsCacheKey(ctx) {
  if (usesApiKey(ctx)) {
    const apiKey = ctx.settings?.apiKey?.trim() ?? '';
    return `apiKey:${apiKey.slice(0, 8)}`;
  }
  const inspection = inspectServiceAccountCredentials(ctx);
  const creds = inspection.creds;
  return creds?.client_email ?? creds?.project_id ?? 'default';
}

module.exports = {
  id: 'gemini',
  label: 'Google Gemini',
  authType: 'dual',
  fallbackModels,
  isConfigured,
  getConfigurationError,
  listModels,
  generate,
  getModelsCacheKey,
};
