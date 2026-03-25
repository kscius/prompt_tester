'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
let savedPrompts    = [];
let savedPanelOpen  = false;
let isSending       = false;
let lastRawText     = '';
let sessionCostUSD  = 0;

// ─── DOM references ──────────────────────────────────────────────────────────
const modelSelect      = document.getElementById('model-select');
const promptInput      = document.getElementById('prompt-input');
const dataInput        = document.getElementById('data-input');
const promptCount      = document.getElementById('prompt-count');
const dataCount        = document.getElementById('data-count');
const sendBtn          = document.getElementById('send-btn');
const sendLabel        = document.getElementById('send-label');
const sendLoading      = document.getElementById('send-loading');
const outputArea       = document.getElementById('output-area');
const outputMeta       = document.getElementById('output-meta');
const tokenInfo        = document.getElementById('token-info');
const timeInfo         = document.getElementById('time-info');
const costInfo         = document.getElementById('cost-info');
const sessionCostEl    = document.getElementById('session-cost');
const finishInfo       = document.getElementById('finish-info');
const tempRange        = document.getElementById('temp-range');
const tempValue        = document.getElementById('temp-value');
const tempHelpBtn      = document.getElementById('temp-help-btn');
const tempHelpPopover  = document.getElementById('temp-help-popover');
const tempHelpClose    = document.getElementById('temp-help-close');
const tempHelpBackdrop = document.getElementById('temp-help-backdrop');
const copyBtn          = document.getElementById('copy-btn');
const exportBtn        = document.getElementById('export-btn');
const clearOutputBtn   = document.getElementById('clear-output-btn');
const clearAllBtn      = document.getElementById('clear-all-btn');
const saveNameInput    = document.getElementById('save-name-input');
const savePresetBtn    = document.getElementById('save-preset-btn');
const savedToggle      = document.getElementById('saved-toggle');
const savedChevron     = document.getElementById('saved-chevron');
const savedBadge       = document.getElementById('saved-badge');
const savedListCtr     = document.getElementById('saved-list-container');
const savedList        = document.getElementById('saved-list');
const credsDot         = document.getElementById('creds-dot');
const credsLabel       = document.getElementById('creds-label');
const credsBtn         = document.getElementById('creds-btn');
const credsModal       = document.getElementById('creds-modal');
const credsBackdrop    = document.getElementById('creds-backdrop');
const credsCloseBtn    = document.getElementById('creds-close-btn');
const credsCurrent     = document.getElementById('creds-current');
const credsDetail      = document.getElementById('creds-detail');
const removeCreds      = document.getElementById('remove-creds-btn');
const importFileBtn    = document.getElementById('import-file-btn');
const credsPasteArea   = document.getElementById('creds-paste-area');
const savePastedBtn    = document.getElementById('save-pasted-creds-btn');

// ─── Initialise ──────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadModels(), refreshCredsStatus(), loadSavedPrompts()]);
  updateCounts();
}

async function loadModels() {
  const models = await window.api.getModels();
  modelSelect.innerHTML = models
    .map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`)
    .join('');
}

async function refreshCredsStatus() {
  const result = await window.api.getCredsStatus();
  applyCredsUI(result);
}

function applyCredsUI(result) {
  if (result.ok) {
    credsDot.className   = 'dot dot-success';
    credsLabel.textContent = result.projectId ?? 'Conectado';
    credsCurrent.classList.remove('hidden');
    credsDetail.innerHTML = `
      <span>Proyecto: <strong style="color:var(--text)">${esc(result.projectId ?? '')}</strong></span>
      <span>Cuenta:   <strong style="color:var(--text)">${esc(result.clientEmail ?? '')}</strong></span>
    `;
  } else {
    credsDot.className   = 'dot dot-error';
    credsLabel.textContent = 'Sin credenciales';
    credsCurrent.classList.add('hidden');
  }
}

async function loadSavedPrompts() {
  savedPrompts = await window.api.listPrompts();
  renderSavedList();
}

// ─── Saved-prompts list rendering ────────────────────────────────────────────
function renderSavedList() {
  savedBadge.textContent = savedPrompts.length;

  if (savedPrompts.length === 0) {
    savedList.innerHTML = '<p class="saved-empty">No hay presets guardados</p>';
    return;
  }

  savedList.innerHTML = savedPrompts.map(p => `
    <div class="saved-item" data-name="${esc(p.name)}">
      <span class="saved-item-name">${esc(p.name)}</span>
      <span class="saved-item-date">${fmtDate(p.updatedAt ?? p.createdAt)}</span>
      <button class="delete-item-btn" data-name="${esc(p.name)}" title="Eliminar preset" aria-label="Eliminar ${esc(p.name)}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

  savedList.querySelectorAll('.saved-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.delete-item-btn')) return;
      loadPreset(item.dataset.name);
    });
  });

  savedList.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const name = btn.dataset.name;
      savedPrompts = await window.api.deletePrompt(name);
      renderSavedList();
      toast(`Eliminado: ${name}`);
    });
  });
}

function loadPreset(name) {
  const p = savedPrompts.find(x => x.name === name);
  if (!p) return;
  promptInput.value  = p.prompt ?? '';
  dataInput.value    = p.data   ?? '';
  saveNameInput.value = name;
  updateCounts();
  toast(`Cargado: ${name}`);
}

// ─── Character count ──────────────────────────────────────────────────────────
function updateCounts() {
  const pLen = promptInput.value.length;
  const dLen = dataInput.value.length;
  promptCount.textContent = pLen > 0 ? `${pLen.toLocaleString()} chars` : '0';
  dataCount.textContent   = dLen > 0 ? `${dLen.toLocaleString()} chars` : '0';
}

promptInput.addEventListener('input', updateCounts);
dataInput.addEventListener('input', updateCounts);

// ─── Temperature slider ───────────────────────────────────────────────────
tempRange.addEventListener('input', () => {
  tempValue.textContent = parseFloat(tempRange.value).toFixed(1);
});

// ─── Ayuda de temperatura (panel clickeable + backdrop) ───────────────────
function isTempHelpOpen() {
  return !tempHelpPopover.classList.contains('hidden');
}

function positionTempHelp() {
  const btn = tempHelpBtn.getBoundingClientRect();
  const pad = 12;
  const w = Math.min(420, window.innerWidth - pad * 2);
  let left = btn.right - w;
  if (left < pad) left = pad;
  if (left + w > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - w - pad);
  tempHelpPopover.style.width = `${w}px`;
  tempHelpPopover.style.left = `${left}px`;
  tempHelpPopover.style.right = 'auto';
  const gap = 10;
  tempHelpPopover.style.bottom = `${window.innerHeight - btn.top + gap}px`;
  tempHelpPopover.style.top = 'auto';
  const maxH = Math.max(160, btn.top - pad * 2);
  tempHelpPopover.style.maxHeight = `${maxH}px`;
}

function openTempHelp() {
  tempHelpBackdrop.classList.remove('hidden');
  tempHelpPopover.classList.remove('hidden');
  tempHelpBtn.setAttribute('aria-expanded', 'true');
  positionTempHelp();
  tempHelpClose.focus();
}

function closeTempHelp() {
  tempHelpBackdrop.classList.add('hidden');
  tempHelpPopover.classList.add('hidden');
  tempHelpBtn.setAttribute('aria-expanded', 'false');
  tempHelpBtn.focus();
}

function toggleTempHelp() {
  if (isTempHelpOpen()) closeTempHelp();
  else openTempHelp();
}

tempHelpBtn.addEventListener('click', e => {
  e.stopPropagation();
  toggleTempHelp();
});

tempHelpClose.addEventListener('click', () => closeTempHelp());
tempHelpBackdrop.addEventListener('click', () => closeTempHelp());

window.addEventListener('resize', () => {
  if (isTempHelpOpen()) positionTempHelp();
});

// ─── Send request ─────────────────────────────────────────────────────────────
async function sendRequest() {
  if (isSending) return;

  const model       = modelSelect.value;
  const prompt      = promptInput.value;
  const data        = dataInput.value;
  const temperature = parseFloat(tempRange.value);

  if (!model) { toast('Selecciona un modelo primero'); return; }

  const status = await window.api.getCredsStatus();
  if (!status.ok) {
    toast('Configura tus credenciales de Google primero');
    openCredsModal();
    return;
  }

  isSending = true;
  sendLabel.classList.add('hidden');
  sendLoading.classList.remove('hidden');
  sendBtn.disabled = true;

  outputArea.innerHTML = `
    <div class="loading-block">
      <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      Procesando con ${esc(model)}…
    </div>`;
  outputMeta.classList.add('hidden');

  const startMs = Date.now();

  try {
    const result = await window.api.callGemini({ model, prompt, data, temperature });
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    if (result.ok) {
      lastRawText = result.text ?? '';
      renderOutput(lastRawText);

      if (result.usage) {
        const u = result.usage;
        tokenInfo.textContent  = `Tokens  entrada: ${u.promptTokenCount ?? '—'} · salida: ${u.candidatesTokenCount ?? '—'} · total: ${u.totalTokenCount ?? '—'}`;
        timeInfo.textContent   = `⏱ ${elapsed}s`;
        finishInfo.textContent = result.finishReason ? `Fin: ${result.finishReason}` : '';

        if (result.cost != null) {
          sessionCostUSD += result.cost;
          costInfo.textContent      = `💰 ${fmtCost(result.cost)}`;
          sessionCostEl.textContent = `Sesión: ${fmtCost(sessionCostUSD)}`;
          sessionCostEl.classList.remove('hidden');
        } else {
          costInfo.textContent = '';
        }

        outputMeta.classList.remove('hidden');
      }
    } else {
      outputArea.innerHTML = `<div class="error-block">❌ Error: ${esc(result.error ?? 'Error desconocido')}</div>`;
    }
  } catch (err) {
    outputArea.innerHTML = `<div class="error-block">❌ Error inesperado: ${esc(err.message)}</div>`;
  } finally {
    isSending = false;
    sendLabel.classList.remove('hidden');
    sendLoading.classList.add('hidden');
    sendBtn.disabled = false;
  }
}

function renderOutput(text) {
  if (!text) {
    outputArea.innerHTML = '<div class="output-empty"><p>Respuesta vacía</p></div>';
    return;
  }

  let html;
  try {
    // marked is loaded from CDN – falls back to <pre> if unavailable
    html = (window.marked && typeof window.marked.parse === 'function')
      ? window.marked.parse(text)
      : `<pre style="white-space:pre-wrap;word-break:break-word">${esc(text)}</pre>`;
  } catch {
    html = `<pre style="white-space:pre-wrap;word-break:break-word">${esc(text)}</pre>`;
  }

  outputArea.innerHTML = `<div class="md-content">${html}</div>`;
}

sendBtn.addEventListener('click', sendRequest);

// Ctrl+Enter shortcut from any focused element
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendRequest();
  }
});

// ─── Output toolbar ───────────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!lastRawText) { toast('No hay contenido para copiar'); return; }
  await navigator.clipboard.writeText(lastRawText);
  toast('Copiado al portapapeles');
});

exportBtn.addEventListener('click', async () => {
  if (!lastRawText) { toast('No hay contenido para exportar'); return; }
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `resultado-${ts}.md`;
  const res  = await window.api.saveOutputFile({ text: lastRawText, defaultName: name });
  if (res.ok)         toast(`Guardado: ${res.filePath.split(/[\\/]/).pop()}`);
  else if (res.error) toast(`Error: ${res.error}`);
});

clearOutputBtn.addEventListener('click', () => {
  lastRawText = '';
  outputArea.innerHTML = `
    <div class="output-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <p>El resultado aparecerá aquí</p>
      <p class="hint">Ctrl+Enter para enviar</p>
    </div>`;
  costInfo.textContent = '';
  outputMeta.classList.add('hidden');
});

clearAllBtn.addEventListener('click', () => {
  promptInput.value   = '';
  dataInput.value     = '';
  saveNameInput.value = '';
  updateCounts();
  clearOutputBtn.click();
  toast('Limpiado');
});

// ─── Save preset ──────────────────────────────────────────────────────────────
savePresetBtn.addEventListener('click', async () => {
  const name = saveNameInput.value.trim();
  if (!name) { toast('Escribe un nombre para el preset'); return; }

  savedPrompts = await window.api.savePrompt({
    name,
    prompt: promptInput.value,
    data:   dataInput.value,
  });
  renderSavedList();
  toast(`Guardado: ${name}`);
});

// ─── Saved panel toggle ───────────────────────────────────────────────────────
savedToggle.addEventListener('click', () => {
  savedPanelOpen = !savedPanelOpen;
  savedListCtr.classList.toggle('hidden', !savedPanelOpen);
  savedToggle.classList.toggle('open', savedPanelOpen);
});

// ─── Resizable divider ────────────────────────────────────────────────────────
(function setupDivider() {
  const divider    = document.getElementById('drag-divider');
  const blockPrompt = document.getElementById('block-prompt');
  const blockData   = document.getElementById('block-data');
  let   dragging   = false;
  let   startY, startTopH, startBotH;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startY   = e.clientY;
    startTopH = blockPrompt.getBoundingClientRect().height;
    startBotH = blockData.getBoundingClientRect().height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dy   = e.clientY - startY;
    const topH = Math.max(80, startTopH + dy);
    const botH = Math.max(80, startBotH - dy);
    blockPrompt.style.flex = `0 0 ${topH}px`;
    blockData.style.flex   = `0 0 ${botH}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor    = '';
    document.body.style.userSelect = '';
  });
})();

// ─── Credentials modal ────────────────────────────────────────────────────────
function openCredsModal() {
  if (isTempHelpOpen()) closeTempHelp();
  credsPasteArea.value = '';
  credsModal.classList.remove('hidden');
  credsPasteArea.focus();
}

function closeCredsModal() {
  credsModal.classList.add('hidden');
}

credsBtn.addEventListener('click', openCredsModal);
credsCloseBtn.addEventListener('click', closeCredsModal);
credsBackdrop.addEventListener('click', closeCredsModal);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (isTempHelpOpen()) {
    closeTempHelp();
    return;
  }
  closeCredsModal();
});

importFileBtn.addEventListener('click', async () => {
  const result = await window.api.selectCredsFile();
  if (result.ok) {
    applyCredsUI(result);
    closeCredsModal();
    toast('Credenciales importadas correctamente');
  } else if (result.error) {
    toast(`Error: ${result.error}`);
  }
});

savePastedBtn.addEventListener('click', async () => {
  const json = credsPasteArea.value.trim();
  if (!json) { toast('Pega el contenido JSON primero'); return; }

  const result = await window.api.saveCredsJson(json);
  if (result.ok) {
    applyCredsUI(result);
    closeCredsModal();
    toast('Credenciales guardadas');
  } else {
    toast(`Error: ${result.error}`);
  }
});

removeCreds.addEventListener('click', async () => {
  const result = await window.api.clearCreds();
  if (result.ok) {
    applyCredsUI({ ok: false });
    toast('Credenciales eliminadas');
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

function fmtCost(usd) {
  if (usd == null) return '';
  if (usd === 0) return '$0.000000 USD';
  // Show enough decimal places to be meaningful
  const decimals = usd < 0.0001 ? 8 : usd < 0.01 ? 6 : 4;
  return `$${usd.toFixed(decimals)} USD`;
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  } catch {
    return '';
  }
}

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className   = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
