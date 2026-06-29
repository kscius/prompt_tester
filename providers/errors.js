/**
 * Formats HTTP error responses from LLM providers into readable Spanish messages.
 */

const STATUS_HINTS = {
  400: 'Solicitud inválida. Revisa el modelo y los parámetros.',
  401: 'API key inválida o ausente. Configúrala en Proveedores y API Keys.',
  403: 'Acceso denegado. Verifica permisos de la cuenta.',
  404: 'Modelo o recurso no encontrado. Prueba otro modelo.',
  408: 'Tiempo de espera agotado. Intenta de nuevo.',
  413: 'El contenido supera el límite de contexto del modelo.',
  429: 'Límite de tasa alcanzado. Espera un momento e intenta de nuevo.',
  500: 'Error interno del proveedor. Intenta más tarde.',
  502: 'El proveedor no está disponible temporalmente.',
  503: 'El proveedor no está disponible temporalmente.',
  529: 'El proveedor está sobrecargado. Intenta en unos segundos.',
};

function tryParseJson(text) {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMessage(_providerId, json) {
  if (!json || typeof json !== 'object') return null;

  if (json.error?.message) return json.error.message;
  if (typeof json.error === 'string') return json.error;
  if (json.message) return json.message;

  if (json.error?.type && json.error?.message) {
    return `${json.error.type}: ${json.error.message}`;
  }

  if (json.error?.status) {
    const msg = json.error.message;
    return msg ? `${json.error.status}: ${msg}` : json.error.status;
  }

  if (json.base_resp?.status_msg) return json.base_resp.status_msg;

  return null;
}

function truncate(text, maxLen = 180) {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

/**
 * @param {number} status - HTTP status code
 * @param {string} body - Raw response body
 * @param {string} [providerId] - Provider id for context
 * @returns {string} Human-readable error message
 */
function formatHttpError(status, body, providerId) {
  const json = tryParseJson(body);
  const detail = extractMessage(providerId, json);
  const hint = STATUS_HINTS[status];
  const prefix = providerId ? `[${providerId}] ` : '';

  if (detail) {
    return `${prefix}HTTP ${status}: ${detail}`;
  }

  if (hint) {
    return `${prefix}HTTP ${status}: ${hint}`;
  }

  const snippet = truncate(body);
  return snippet
    ? `${prefix}HTTP ${status}: ${snippet}`
    : `${prefix}HTTP ${status}: Error desconocido`;
}

module.exports = { formatHttpError, extractMessage, STATUS_HINTS };
