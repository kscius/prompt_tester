'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { renderMarkdownSafe } = require('../../renderer/md-safe.js');

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

describe('renderMarkdownSafe', () => {
  it('escapa como pre si no hay parser', () => {
    const html = renderMarkdownSafe('<b>x</b>', { escapeHtml: esc });
    assert.equal(html, '<pre style="white-space:pre-wrap;word-break:break-word">&lt;b&gt;x&lt;/b&gt;</pre>');
  });

  it('no inyecta HTML de marked si falta el sanitizer', () => {
    const html = renderMarkdownSafe('hola <img onerror=alert(1)>', {
      parse: (t) => `<p>${t}</p>`,
      escapeHtml: esc,
    });
    assert.equal(
      html,
      '<pre style="white-space:pre-wrap;word-break:break-word">hola &lt;img onerror=alert(1)&gt;</pre>'
    );
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<p>'));
  });

  it('devuelve HTML sanitizado cuando hay parser y sanitizer', () => {
    const html = renderMarkdownSafe('**ok** <script>alert(1)</script>', {
      parse: (t) => `<p>${t}</p>`,
      sanitize: (raw) => raw.replace(/<script[\s\S]*?<\/script>/gi, ''),
      escapeHtml: esc,
    });
    assert.equal(html, '<p>**ok** </p>');
    assert.ok(!html.includes('<script'));
  });

  it(' Ante error del parser cae al fallback escapado', () => {
    const html = renderMarkdownSafe('x <y>', {
      parse: () => { throw new Error('boom'); },
      sanitize: (h) => h,
      escapeHtml: esc,
    });
    assert.equal(html, '<pre style="white-space:pre-wrap;word-break:break-word">x &lt;y&gt;</pre>');
  });
});
