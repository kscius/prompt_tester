/**
 * Shared fetch helpers for LLM provider HTTP calls.
 * Provider generate/listModels previously used bare fetch() with no timeout,
 * so a stalled network left the UI stuck on "Procesando…" forever.
 */

/** Timeout for listing models (and similar short requests). */
const LIST_MODELS_TIMEOUT_MS = 30_000;

/** Timeout for chat/completions and equivalent generate calls. */
const GENERATE_TIMEOUT_MS = 120_000;

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isAbortError(err) {
  return Boolean(err && (err.name === 'AbortError' || err.code === 'ABORT_ERR'));
}

/**
 * User-facing Spanish message when a provider request times out.
 * @param {{ providerId?: string, timeoutMs?: number, operation?: 'generate'|'listModels' }} [opts]
 * @returns {string}
 */
function timeoutErrorMessage({ providerId, timeoutMs, operation } = {}) {
  const seconds = Math.max(1, Math.round((timeoutMs || 0) / 1000));
  const prefix = providerId ? `[${providerId}] ` : '';
  const op =
    operation === 'listModels'
      ? 'al listar modelos'
      : 'al generar la respuesta';
  return `${prefix}Tiempo de espera agotado ${op} (${seconds}s). Intenta de nuevo.`;
}

/**
 * fetch() with AbortController timeout. Replaces AbortError with a Spanish message.
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @param {{ timeoutMs?: number, providerId?: string, operation?: 'generate'|'listModels' }} [meta]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, meta = {}) {
  const timeoutMs = meta.timeoutMs ?? GENERATE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const { signal: outerSignal, ...rest } = options;
  let onOuterAbort;

  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(timer);
      const err = new Error(
        timeoutErrorMessage({
          providerId: meta.providerId,
          timeoutMs,
          operation: meta.operation,
        }),
      );
      err.name = 'AbortError';
      throw err;
    }
    onOuterAbort = () => controller.abort();
    outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (e) {
    if (isAbortError(e)) {
      const err = new Error(
        timeoutErrorMessage({
          providerId: meta.providerId,
          timeoutMs,
          operation: meta.operation,
        }),
      );
      err.name = 'AbortError';
      err.cause = e;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (outerSignal && onOuterAbort) {
      outerSignal.removeEventListener('abort', onOuterAbort);
    }
  }
}

module.exports = {
  LIST_MODELS_TIMEOUT_MS,
  GENERATE_TIMEOUT_MS,
  isAbortError,
  timeoutErrorMessage,
  fetchWithTimeout,
};
