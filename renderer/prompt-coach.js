/**
 * Asistente flotante de mejora de prompts.
 * Requiere que renderer.js exponga window.promptTester antes de init().
 */
(function () {
  'use strict';

  const PROMPT_COACH_SYSTEM = `You are a senior prompt engineer. The user tests prompts in a desktop "Prompt Tester" that calls **Google Gemini** via \`generateContent\`: optional **systemInstruction** plus a single user **data** message. Your job is to tighten that pairing and sampling so the next run better matches their intent.

## Input contract (each user message you see)
Structured Markdown sections, not free chat. Treat them as ground truth:
1. **Metadatos del paquete** — limits and truncation rules (read first).
2. **Historial reciente (este chat de asistente)** — prior coach Q/A (may be empty).
3. **Contexto del probador principal** — selected model id and current slider temperature (0–2).
4. **Instrucción del sistema** and **Datos / mensaje de usuario** — what will be sent as systemInstruction vs user content.
5. **Última respuesta del modelo principal** — the newest main output, with the **temperature and model id used for that call**, or an explicit note if there is none.
6. **Nueva petición del usuario** — their new feedback (often Spanish).

**Truncation:** If any block ends with \`[…contenido truncado por longitud…]\`, you do **not** have the full text. Say so, avoid fine-grained claims about unseen parts, and recommend high-leverage edits you can still justify (structure, role, format, sampling).

## Analysis playbook (internal order; do not dump raw chain-of-thought)
1. **Intent** — What outcome does the user want from the *next* main run?
2. **Role & scope** — Does systemInstruction clearly separate persona, task, constraints, and output contract?
3. **Data vs system** — Should some rules live in user data instead (variable input) or vice versa?
4. **Grounding** — Does the last output (if any) violate instructions, drift, hallucinate structure, or mismatch format? Tie causes to specific lines or patterns you can quote.
5. **Sampling** — Map issues to temperature: lower (≈0–0.4) for extraction/JSON/repeatability; mid (≈0.5–1.0) for balanced prose; higher (≈1.2–2.0) for brainstorming only when creativity outweighs factual risk.
6. **Prior coach turns** — Maintain consistency; refine rather than contradict earlier advice unless the user changed goals.

## What you must produce
- **Concrete** edits: add/remove/rephrase with clear *where* (system vs datos) and *why*.
- If the user references a phrase ("donde dice X"), **quote** the shortest substring from the last response or from the provided blocks, then explain the fix.
- If there is **no** last response, still improve system + datos from the stated goal and suggest a first-run temperature.
- Never invent citations, URLs, metrics, or tool capabilities. If you see legal/medical/financial risk, flag it and suggest compliant disclaimers or refusal patterns.
- Do **not** prescribe generic "use all tools/MCPs/plugins" unless the user’s own system prompt names them explicitly.

## Response language
Write the **entire** visible answer in **Spanish**. Keep quoted prompt fragments, code, JSON keys, and model ids in their original form.

## Output shape (Markdown; use these headings in order)
### Diagnóstico
1–4 frases: brecha principal entre intención, instrucciones, datos, salida reciente (si hay) y temperatura.

### Cambios recomendados (priorizados)
Lista numerada. Cada ítem: acción concreta, capa (**Sistema** / **Datos** / **Temperatura** / **Ambas**), y efecto esperado en la siguiente ejecución.

### Temperatura
Una línea: valor o rango sugerido en [0,2], ligado al tipo de tarea y al riesgo observado.

### Snippets (solo si aportan)
Opcional. Máximo dos bloques \`\`\`text con etiqueta clara: \`**Sistema (sugerido)**\` o \`**Datos (sugerido)**\`. Fragmentos cortos y pegables, no reescribir todo el prompt sin necesidad.

### Comprobación rápida
2–4 preguntas sí/no que el usuario puede usar para validar si el próximo envío va en la dirección correcta.`;

  const COACH_API_TEMP = 0.35;
  const COACH_CTX_TRUNC = 12000;

  const coachMessages = [];
  let coachSending = false;

  const coachFab = document.getElementById('coach-fab');
  const coachPanel = document.getElementById('coach-panel');
  const coachMinimizeBtn = document.getElementById('coach-minimize-btn');
  const coachClearBtn = document.getElementById('coach-clear-btn');
  const coachOpenToolbarBtn = document.getElementById('coach-open-toolbar-btn');
  const coachMessagesEl = document.getElementById('coach-messages');
  const coachInput = document.getElementById('coach-input');
  const coachSendBtn = document.getElementById('coach-send');

  if (!coachFab || !coachPanel) return;

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function mdToHtml(text) {
    try {
      return (window.marked && typeof window.marked.parse === 'function')
        ? window.marked.parse(text)
        : `<pre style="white-space:pre-wrap;word-break:break-word">${esc(text)}</pre>`;
    } catch {
      return `<pre style="white-space:pre-wrap;word-break:break-word">${esc(text)}</pre>`;
    }
  }

  function pt() {
    return window.promptTester;
  }

  function isCoachPanelOpen() {
    return !coachPanel.classList.contains('hidden');
  }

  function openCoachPanel() {
    coachPanel.classList.remove('hidden');
    coachFab.setAttribute('aria-expanded', 'true');
    renderCoachMessages();
    setTimeout(() => coachInput.focus(), 80);
  }

  function closeCoachPanel() {
    coachPanel.classList.add('hidden');
    coachFab.setAttribute('aria-expanded', 'false');
    coachFab.focus();
  }

  function toggleCoachPanel() {
    if (isCoachPanelOpen()) closeCoachPanel();
    else openCoachPanel();
  }

  window.__promptCoachHandleEscape = function () {
    if (!isCoachPanelOpen()) return false;
    closeCoachPanel();
    return true;
  };

  function truncCtx(s) {
    if (s == null || s === '') return '';
    const t = String(s);
    if (t.length <= COACH_CTX_TRUNC) return t;
    return `${t.slice(0, COACH_CTX_TRUNC)}\n\n[…contenido truncado por longitud…]`;
  }

  function getLatestMainEntry() {
    const h = pt()?.responseHistory;
    if (!h || !h.length) return null;
    return h[h.length - 1];
  }

  function buildCoachHistorySection() {
    const recent = coachMessages.slice(-10);
    if (!recent.length) return '(Sin mensajes previos en este asistente.)';
    return recent
      .map(m => {
        const label = m.role === 'user' ? 'Usuario (asistente)' : m.role === 'error' ? 'Error' : 'Asistente';
        return `### ${label}\n${m.text}`;
      })
      .join('\n\n');
  }

  function buildCoachPayload(userLine) {
    const p = pt();
    if (!p) return userLine;
    const last = getLatestMainEntry();
    const sys = truncCtx(p.promptInput.value);
    const data = truncCtx(p.dataInput.value);
    const model = p.modelSelect.value || '(no seleccionado)';
    const tempMain = parseFloat(p.tempRange.value);
    let lastSection;
    if (last) {
      lastSection = `Temperatura usada en esa respuesta: ${parseFloat(last.temperature).toFixed(1)}\nModelo usado: ${last.model}\n\n---\n${truncCtx(last.text)}`;
    } else {
      lastSection = '(Aún no hay respuestas en el historial principal. Puedes aconsejar solo sobre instrucción y datos.)';
    }

    return `## Metadatos del paquete
- Origen: app de escritorio "Prompt Tester" → API Gemini \`generateContent\` (systemInstruction opcional + un turno de usuario con los datos).
- Este bloque puede estar **truncado**: si ves la línea \`[…contenido truncado por longitud…]\`, el texto original era más largo; no infieras lo omitido.
- Historial del asistente adjunto: hasta **10** mensajes recientes (usuario/asistente/error).

---

## Historial reciente (este chat de asistente)
${buildCoachHistorySection()}

---

## Contexto del probador principal
- Modelo seleccionado ahora en el selector: \`${model}\`
- Temperatura actual en el probador (slider): **${tempMain.toFixed(1)}** (0–2)

## Instrucción del sistema (systemInstruction)
\`\`\`
${sys || '(vacío)'}
\`\`\`

## Datos / mensaje de usuario al modelo principal
\`\`\`
${data || '(vacío)'}
\`\`\`

## Última respuesta del modelo principal (más reciente)
${lastSection}

---

## Nueva petición del usuario
${userLine}`;
  }

  function renderCoachMessages() {
    if (!coachMessages.length) {
      coachMessagesEl.innerHTML = `
      <div class="coach-msg coach-msg--assistant">
        <div class="md-content">
          <p>Escribe qué quieres cambiar (tono, formato, una frase concreta, longitud, etc.).</p>
          <p>Se enviará al modelo tu <strong>instrucción del sistema</strong>, los <strong>datos</strong>, la <strong>última respuesta</strong> del historial y la temperatura usada en esa respuesta.</p>
        </div>
      </div>`;
      return;
    }

    coachMessagesEl.innerHTML = coachMessages.map(m => {
      if (m.role === 'user') {
        return `<div class="coach-msg coach-msg--user">${esc(m.text)}</div>`;
      }
      if (m.role === 'error') {
        return `<div class="coach-msg coach-msg--error">${esc(m.text)}</div>`;
      }
      return `<div class="coach-msg coach-msg--assistant"><div class="md-content">${mdToHtml(m.text)}</div></div>`;
    }).join('');

    coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight;
  }

  function clearCoachChat() {
    coachMessages.length = 0;
    renderCoachMessages();
    pt()?.toast('Conversación del asistente vaciada');
  }

  async function sendCoachRequest() {
    const p = pt();
    if (!p) return;
    if (coachSending) return;
    const line = coachInput.value.trim();
    if (!line) {
      p.toast('Escribe un mensaje para el asistente');
      return;
    }

    const model = p.modelSelect.value;
    if (!model) {
      p.toast('Selecciona un modelo primero');
      return;
    }

    const status = await window.api.getCredsStatus();
    if (!status.ok) {
      p.toast('Configura credenciales primero');
      p.openCredsModal();
      return;
    }

    coachSending = true;
    coachSendBtn.disabled = true;
    coachInput.disabled = true;

    coachMessages.push({ role: 'user', text: line });
    coachInput.value = '';
    renderCoachMessages();

    const loadingId = `coach-loading-${Date.now()}`;
    coachMessagesEl.insertAdjacentHTML('beforeend', `<div id="${loadingId}" class="coach-msg coach-msg--loading">
    <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    Analizando…
  </div>`);
    coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight;

    try {
      const payload = buildCoachPayload(line);
      const result = await window.api.callGemini({
        model,
        prompt: PROMPT_COACH_SYSTEM,
        data: payload,
        temperature: COACH_API_TEMP,
      });

      document.getElementById(loadingId)?.remove();

      if (result.ok) {
        coachMessages.push({ role: 'assistant', text: result.text ?? '' });
      } else {
        coachMessages.push({ role: 'error', text: result.error ?? 'Error desconocido' });
      }
      renderCoachMessages();
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      coachMessages.push({ role: 'error', text: err.message || String(err) });
      renderCoachMessages();
    } finally {
      coachSending = false;
      coachSendBtn.disabled = false;
      coachInput.disabled = false;
      coachInput.focus();
    }
  }

  coachFab.addEventListener('click', () => toggleCoachPanel());
  coachMinimizeBtn.addEventListener('click', () => closeCoachPanel());
  coachOpenToolbarBtn.addEventListener('click', () => openCoachPanel());
  coachClearBtn.addEventListener('click', () => clearCoachChat());
  coachSendBtn.addEventListener('click', () => sendCoachRequest());
  coachInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCoachRequest();
    }
  });

  renderCoachMessages();
})();
