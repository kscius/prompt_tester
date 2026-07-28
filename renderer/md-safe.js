/**
 * Markdown → HTML seguro para el renderer (Electron).
 * Si hay parser (marked) y sanitizer (DOMPurify), usa ambos.
 * Si falta el sanitizer, nunca inyecta HTML crudo de marked: escapa como <pre>.
 */
(function (root) {
  const PRE_STYLE = 'white-space:pre-wrap;word-break:break-word';

  function renderMarkdownSafe(text, deps = {}) {
    const escapeHtml = typeof deps.escapeHtml === 'function'
      ? deps.escapeHtml
      : (s) => String(s ?? '');
    const fallback = () => `<pre style="${PRE_STYLE}">${escapeHtml(text)}</pre>`;

    try {
      const parse = deps.parse;
      if (typeof parse !== 'function') return fallback();
      const raw = parse(text);
      const sanitize = deps.sanitize;
      if (typeof sanitize !== 'function') return fallback();
      return sanitize(raw);
    } catch {
      return fallback();
    }
  }

  root.renderMarkdownSafe = renderMarkdownSafe;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderMarkdownSafe };
  }
})(typeof window !== 'undefined' ? window : globalThis);
