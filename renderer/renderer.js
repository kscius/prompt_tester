'use strict';

// ─── Provider definitions ────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    desc: 'GPT-4o, o1, o3 y modelos de OpenAI.',
    icon: '<svg class="provider-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M22.28 9.82a5.8 5.8 0 00-.52-4.78 5.86 5.86 0 00-6.31-2.82A5.86 5.86 0 007.82.42a5.87 5.87 0 00-5.58 4.03A5.86 5.86 0 00.08 9.4a5.86 5.86 0 002.1 6.56 5.8 5.8 0 00.52 4.78 5.86 5.86 0 006.31 2.82 5.86 5.86 0 005.63 1.98 5.87 5.87 0 005.58-4.03 5.86 5.86 0 001.16-4.95 5.86 5.86 0 00-2.1-6.56zM13.25 20.1l-3.3-1.76.83-1.45 3.3 1.76-.83 1.45zm1.45-2.52l-3.3-1.76 5.58-9.66 3.3 1.76-5.58 9.66zM7.4 18.58l-3.3-1.76L9.68 7.16l3.3 1.76L7.4 18.58zm-.83-10.1L3.27 6.72l1.45-.83 3.3 1.76-1.45.83z"/></svg>',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d97757',
    desc: 'Claude Opus, Sonnet y Haiku.',
    icon: '<svg class="provider-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16.05 3H7.95L4 21h4.1l.7-3.5h6.4L15.8 21H20l-3.95-18zm-4.55 12.5H9.5L12 6.5l2.5 9z"/></svg>',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    color: '#4285f4',
    desc: 'API Key o Service Account JSON de Google AI.',
    icon: '<svg class="provider-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    color: '#6366f1',
    desc: 'Requiere API Key y Group ID opcional.',
    icon: '<svg class="provider-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h6v16H4V4zm10 0h6v16h-6V4z"/></svg>',
    hasGroupId: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    color: '#f97316',
    desc: 'Mistral Large, Medium y Codestral.',
    icon: '<svg class="provider-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg>',
  },
  {
    id: 'groq',
    name: 'Groq',
    color: '#f55036',
    desc: 'Inferencia ultrarrápida con Llama y Mixtral.',
    icon: '<svg class="provider-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4d6bfe',
    desc: 'DeepSeek Chat, Reasoner y Coder.',
    icon: '<svg class="provider-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8 6 4 8 4 13a8 8 0 0016 0c0-5-4-7-8-11z"/><circle cx="12" cy="14" r="2" fill="currentColor" stroke="none"/></svg>',
  },
];

// ─── State ──────────────────────────────────────────────────────────────────
let savedPrompts       = [];
let savedPanelOpen     = false;
let isSending          = false;
let lastRawText        = '';
let sessionCostUSD     = 0;
let responseHistory    = [];
let providersStatus    = { activeProvider: 'gemini', providers: {} };
let modalProviderId    = 'gemini';
let geminiAuthMode     = 'api-key';

// ─── DOM references ──────────────────────────────────────────────────────────
const providerSelect   = document.getElementById('provider-select');
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
const pricingSourceEl  = document.getElementById('pricing-source');
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
const providersSidebar = document.getElementById('providers-sidebar');
const providersPanel   = document.getElementById('providers-panel');

// ─── Backward-compat API wrappers ───────────────────────────────────────────
async function getProvidersOverview() {
  if (typeof window.api.getProvidersStatus === 'function') {
    return window.api.getProvidersStatus();
  }
  const legacy = await window.api.getCredsStatus();
  return {
    activeProvider: 'gemini',
    providers: {
      gemini: legacy.ok
        ? { configured: true, authMode: 'service-account', projectId: legacy.projectId, clientEmail: legacy.clientEmail, maskedKey: legacy.projectId }
        : { configured: false },
    },
  };
}

async function callLLM(args) {
  if (typeof window.api.callLLM === 'function') {
    return window.api.callLLM(args);
  }
  return window.api.callGemini(args);
}

async function fetchModels(providerId) {
  return window.api.getModels(providerId);
}

function getActiveProviderId() {
  return providerSelect?.value || providersStatus.activeProvider || 'gemini';
}

function getProviderDef(id) {
  return PROVIDERS.find(p => p.id === id) ?? { id, name: id, color: 'var(--accent)', desc: '', icon: '' };
}

function isProviderConfigured(info) {
  return !!(info?.configured || info?.ok);
}

function getMaskedLabel(info) {
  if (info?.maskedKey) return info.maskedKey;
  if (info?.authMode === 'service-account' && info?.projectId) return info.projectId;
  if (info?.projectId) return info.projectId;
  return 'Configurado';
}

// ─── Initialise ──────────────────────────────────────────────────────────────
async function init() {
  try {
    renderProvidersModal();
    await loadProviders();
    const results = await Promise.allSettled([
      loadModels(),
      refreshCredsStatus(),
      loadSavedPrompts(),
      loadPricingStatus(),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') console.error('[init]', r.reason);
    }
    updateCounts();
    schedulePricingStatusPoll();
  } catch (e) {
    console.error('[init] Error fatal:', e);
    toast('Error al iniciar la aplicación. Revisa la consola.');
  }
}

async function loadPricingStatus() {
  if (typeof window.api.getPricingStatus !== 'function') return;
  try {
    const status = await window.api.getPricingStatus();
    applyPricingStatusUI(status);
  } catch {}
}

function schedulePricingStatusPoll() {
  if (typeof window.api.getPricingStatus !== 'function') return;
  setTimeout(async () => {
    try {
      const status = await window.api.getPricingStatus();
      applyPricingStatusUI(status);
    } catch {}
  }, 4000);
}

function applyPricingStatusUI(status) {
  if (!pricingSourceEl || !status) return;
  const label = fmtPricingSource(status);
  if (!label) {
    pricingSourceEl.classList.add('hidden');
    return;
  }
  pricingSourceEl.textContent = label;
  pricingSourceEl.title = status.error
    ? `No se pudieron actualizar tarifas en línea: ${status.error}. Se usan valores en caché o embebidos.`
    : `Tarifas ${status.source === 'litellm' ? 'sincronizadas' : 'embebidas'} · ${status.modelCount ?? 0} modelos indexados`;
  pricingSourceEl.classList.remove('hidden');
}

function fmtPricingSource(status) {
  if (!status) return '';
  if (status.fetchedAt) {
    try {
      const d = new Date(status.fetchedAt);
      const date = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      return `Tarifas · ${date} ${time}`;
    } catch {
      return 'Tarifas actualizadas';
    }
  }
  if (status.source === 'bundled') return 'Tarifas embebidas';
  if (status.source === 'cache') return 'Tarifas en caché';
  return '';
}

async function loadProviders() {
  let list = PROVIDERS;
  if (typeof window.api.listProviders === 'function') {
    try {
      const remote = await window.api.listProviders();
      if (Array.isArray(remote) && remote.length) list = remote;
    } catch {}
  }

  providersStatus = await getProvidersOverview();
  const active = providersStatus.activeProvider ?? 'gemini';

  providerSelect.innerHTML = list.map(p => {
    const id = p.id ?? p.providerId;
    const name = p.name ?? p.label ?? id;
    return `<option value="${esc(id)}"${id === active ? ' selected' : ''}>${esc(name)}</option>`;
  }).join('');

  if (!providerSelect.value && providerSelect.options.length) {
    providerSelect.selectedIndex = 0;
  }
}

async function loadModels() {
  const previous = modelSelect.value;
  const providerId = getActiveProviderId();
  try {
    const result = await fetchModels(providerId);
    const models = Array.isArray(result) ? result : (result?.models ?? []);
    if (result?.warning) {
      toast(`Lista de respaldo: ${result.warning}`);
    }
    modelSelect.innerHTML = (models ?? [])
      .map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`)
      .join('');
    if (!modelSelect.options.length) {
      modelSelect.innerHTML = '<option value="">Sin modelos disponibles</option>';
    }
    if (previous && [...modelSelect.options].some(o => o.value === previous)) {
      modelSelect.value = previous;
    }
  } catch (e) {
    console.error('[loadModels]', e);
    modelSelect.innerHTML = '<option value="">Sin modelos disponibles</option>';
    toast('No se pudieron cargar modelos; usando lista vacía.');
  }
}

async function refreshCredsStatus() {
  try {
    providersStatus = await getProvidersOverview();
    applyProviderStatusUI(providersStatus);
    updateProviderPanels(providersStatus);
  } catch (e) {
    console.error('[refreshCredsStatus]', e);
    toast('No se pudo actualizar el estado de proveedores.');
  }
}

function applyProviderStatusUI(status) {
  const active = getActiveProviderId();
  const info = status.providers?.[active] ?? {};
  const def = getProviderDef(active);

  if (isProviderConfigured(info)) {
    credsDot.className = 'dot dot-success';
    credsLabel.textContent = `${def.name} · ${getMaskedLabel(info)}`;
  } else {
    credsDot.className = 'dot dot-error';
    credsLabel.textContent = `${def.name} · Sin API key`;
  }

  providersSidebar?.querySelectorAll('.provider-tab').forEach(tab => {
    const pid = tab.dataset.provider;
    const pInfo = status.providers?.[pid];
    const dot = tab.querySelector('.provider-tab-dot');
    if (dot) dot.classList.toggle('configured', isProviderConfigured(pInfo));
  });
}

// ─── Providers modal ─────────────────────────────────────────────────────────
function renderProvidersModal() {
  providersSidebar.innerHTML = PROVIDERS.map(p => `
    <button type="button" class="provider-tab" data-provider="${esc(p.id)}" aria-label="${esc(p.name)}">
      <span style="color:${esc(p.color)}">${p.icon}</span>
      <span class="provider-tab-name">${esc(p.name)}</span>
      <span class="provider-tab-dot"></span>
    </button>
  `).join('');

  providersPanel.innerHTML = PROVIDERS.map(p => {
    if (p.id === 'gemini') return renderGeminiPanel(p);
    return renderApiKeyPanel(p);
  }).join('');

  providersSidebar.querySelectorAll('.provider-tab').forEach(tab => {
    tab.addEventListener('click', () => switchModalProvider(tab.dataset.provider));
  });

  setupProviderPanelEvents();
  switchModalProvider(modalProviderId);
}

function renderApiKeyPanel(p) {
  const groupField = p.hasGroupId ? `
    <div class="provider-field">
      <label class="provider-field-label" for="key-${esc(p.id)}-group">Group ID (opcional)</label>
      <input type="text" id="key-${esc(p.id)}-group" class="provider-input" placeholder="grp_…" autocomplete="off" spellcheck="false">
    </div>` : '';

  return `
    <div class="provider-panel" data-provider="${esc(p.id)}" id="panel-${esc(p.id)}">
      <div class="provider-panel-head">
        <span class="provider-panel-icon" style="color:${esc(p.color)}">${p.icon.replace('provider-tab-icon', 'provider-panel-icon-svg')}</span>
        <div>
          <div class="provider-panel-title">${esc(p.name)}</div>
          <p class="provider-panel-desc">${esc(p.desc)}</p>
        </div>
      </div>
      <div class="provider-status-banner unconfigured" id="status-${esc(p.id)}">
        <span class="dot dot-error"></span>
        <span>Sin API key configurada</span>
      </div>
      <div class="provider-field">
        <label class="provider-field-label" for="key-${esc(p.id)}">API Key</label>
        <input type="password" id="key-${esc(p.id)}" class="provider-input" placeholder="sk-…" autocomplete="off" spellcheck="false">
      </div>
      ${groupField}
      <div class="provider-actions">
        <button type="button" class="btn btn-primary provider-save-btn" data-provider="${esc(p.id)}">Guardar</button>
        <button type="button" class="btn btn-danger-ghost provider-clear-btn" data-provider="${esc(p.id)}">Limpiar</button>
      </div>
    </div>`;
}

function renderGeminiPanel(p) {
  return `
    <div class="provider-panel" data-provider="gemini" id="panel-gemini">
      <div class="provider-panel-head">
        <span class="provider-panel-icon" style="color:${esc(p.color)}">${p.icon.replace('provider-tab-icon', 'provider-panel-icon-svg')}</span>
        <div>
          <div class="provider-panel-title">${esc(p.name)}</div>
          <p class="provider-panel-desc">${esc(p.desc)}</p>
        </div>
      </div>
      <div class="provider-status-banner unconfigured" id="status-gemini">
        <span class="dot dot-error"></span>
        <span>Sin credenciales configuradas</span>
      </div>
      <div class="gemini-auth-toggle" role="group" aria-label="Modo de autenticación Gemini">
        <button type="button" class="gemini-auth-btn active" data-mode="api-key">API Key</button>
        <button type="button" class="gemini-auth-btn" data-mode="service-account">Service Account</button>
      </div>
      <div class="gemini-section gemini-api-section" id="gemini-api-section">
        <div class="provider-field">
          <label class="provider-field-label" for="key-gemini">API Key</label>
          <input type="password" id="key-gemini" class="provider-input" placeholder="AIza…" autocomplete="off" spellcheck="false">
        </div>
        <div class="provider-actions">
          <button type="button" class="btn btn-primary provider-save-btn" data-provider="gemini" data-auth="api-key">Guardar</button>
          <button type="button" class="btn btn-danger-ghost provider-clear-btn" data-provider="gemini">Limpiar</button>
        </div>
      </div>
      <div class="gemini-section gemini-sa-section hidden" id="gemini-sa-section">
        <div id="gemini-sa-detail" class="provider-sa-detail hidden"></div>
        <div class="modal-section">
          <p class="modal-section-title">Importar archivo JSON</p>
          <button type="button" id="import-file-btn" class="btn btn-secondary w-full">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Seleccionar archivo service-account.json
          </button>
        </div>
        <div class="modal-divider"><span>o pegar JSON</span></div>
        <div class="modal-section">
          <textarea
            id="creds-paste-area"
            class="code-area creds-paste-area"
            placeholder='{"type":"service_account","project_id":"mi-proyecto","client_email":"...","private_key":"..."}'
            spellcheck="false"
          ></textarea>
          <button type="button" id="save-pasted-creds-btn" class="btn btn-primary w-full">Guardar credenciales</button>
        </div>
        <div class="provider-actions">
          <button type="button" class="btn btn-danger-ghost provider-clear-btn" data-provider="gemini">Limpiar</button>
        </div>
      </div>
    </div>`;
}

function switchModalProvider(providerId) {
  modalProviderId = providerId;
  providersSidebar.querySelectorAll('.provider-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.provider === providerId);
  });
  providersPanel.querySelectorAll('.provider-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.provider === providerId);
  });
}

function updateProviderPanels(status) {
  for (const p of PROVIDERS) {
    const info = status.providers?.[p.id] ?? {};
    const banner = document.getElementById(`status-${p.id}`);
    if (!banner) continue;

    if (isProviderConfigured(info)) {
      banner.className = 'provider-status-banner';
      const label = p.id === 'gemini' && info.authMode === 'service-account'
        ? `Service Account · ${esc(info.projectId ?? 'configurado')}`
        : getMaskedLabel(info);
      banner.innerHTML = `<span class="dot dot-success"></span><span>${esc(label)}</span>`;
    } else {
      banner.className = 'provider-status-banner unconfigured';
      banner.innerHTML = `<span class="dot dot-error"></span><span>${p.id === 'gemini' ? 'Sin credenciales configuradas' : 'Sin API key configurada'}</span>`;
    }

    if (p.id === 'gemini' && info.authMode === 'service-account') {
      geminiAuthMode = 'service-account';
      setGeminiAuthMode('service-account');
      const detail = document.getElementById('gemini-sa-detail');
      if (detail && info.projectId) {
        detail.classList.remove('hidden');
        detail.innerHTML = `
          <span>Proyecto: <strong>${esc(info.projectId)}</strong></span>
          <span>Cuenta: <strong>${esc(info.clientEmail ?? '')}</strong></span>`;
      }
    }
  }
}

function setGeminiAuthMode(mode) {
  geminiAuthMode = mode;
  document.querySelectorAll('.gemini-auth-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.getElementById('gemini-api-section')?.classList.toggle('hidden', mode !== 'api-key');
  document.getElementById('gemini-sa-section')?.classList.toggle('hidden', mode !== 'service-account');
}

function setupProviderPanelEvents() {
  document.querySelectorAll('.gemini-auth-btn').forEach(btn => {
    btn.addEventListener('click', () => setGeminiAuthMode(btn.dataset.mode));
  });

  document.querySelectorAll('.provider-save-btn').forEach(btn => {
    btn.addEventListener('click', () => saveProviderKey(btn.dataset.provider));
  });

  document.querySelectorAll('.provider-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => clearProviderKey(btn.dataset.provider));
  });

  document.getElementById('import-file-btn')?.addEventListener('click', importServiceAccountFile);
  document.getElementById('save-pasted-creds-btn')?.addEventListener('click', savePastedServiceAccount);
}

async function saveProviderKey(providerId) {
  const keyInput = document.getElementById(`key-${providerId}`);
  const apiKey = keyInput?.value.trim();
  if (!apiKey) {
    toast('Introduce una API key');
    keyInput?.focus();
    return;
  }

  const payload = { providerId, apiKey };
  if (providerId === 'minimax') {
    const groupId = document.getElementById('key-minimax-group')?.value.trim();
    if (groupId) payload.groupId = groupId;
  }

  try {
    let result;
    if (typeof window.api.saveProviderApiKey === 'function') {
      result = await window.api.saveProviderApiKey(payload);
    } else if (providerId === 'gemini') {
      result = await window.api.saveCredsJson(JSON.stringify({ type: 'api_key', api_key: apiKey }));
    } else {
      toast('API de proveedores no disponible');
      return;
    }

    if (result?.ok !== false && !result?.error) {
      if (keyInput) keyInput.value = '';
      await refreshCredsStatus();
      await loadModels();
      toast(`${getProviderDef(providerId).name} guardado`);
    } else {
      toast(`Error: ${result?.error ?? 'No se pudo guardar'}`);
    }
  } catch (e) {
    console.error('[saveProviderKey]', e);
    toast(`Error: ${e.message ?? 'No se pudo guardar'}`);
  }
}

async function clearProviderKey(providerId) {
  let result;
  if (typeof window.api.clearProvider === 'function') {
    result = await window.api.clearProvider(providerId);
  } else if (providerId === 'gemini' && typeof window.api.clearCreds === 'function') {
    result = await window.api.clearCreds();
  } else {
    toast('API de proveedores no disponible');
    return;
  }

  if (result?.ok !== false && !result?.error) {
    const keyEl = document.getElementById(`key-${providerId}`);
    if (keyEl) keyEl.value = '';
    if (providerId === 'gemini') {
      const pasteArea = document.getElementById('creds-paste-area');
      if (pasteArea) pasteArea.value = '';
      document.getElementById('gemini-sa-detail')?.classList.add('hidden');
    }
    await refreshCredsStatus();
    await loadModels();
    toast(`${getProviderDef(providerId).name} eliminado`);
  } else {
    toast(`Error: ${result?.error ?? 'No se pudo eliminar'}`);
  }
}

async function importServiceAccountFile() {
  const result = await window.api.selectCredsFile();
  if (result?.ok) {
    try {
      await refreshCredsStatus();
      await loadModels();
      toast('Service Account importado');
    } catch (e) {
      console.error('[importServiceAccountFile]', e);
      toast('Service Account importado, pero falló la actualización de modelos.');
    }
  } else if (result?.error) {
    toast(`Error: ${result.error}`);
  }
}

async function savePastedServiceAccount() {
  const pasteArea = document.getElementById('creds-paste-area');
  const json = pasteArea?.value.trim();
  if (!json) {
    toast('Pega el contenido JSON primero');
    return;
  }

  const result = await window.api.saveCredsJson(json);
  if (result?.ok) {
    if (pasteArea) pasteArea.value = '';
    try {
      await refreshCredsStatus();
      await loadModels();
      toast('Service Account guardado');
    } catch (e) {
      console.error('[savePastedServiceAccount]', e);
      toast('Service Account guardado, pero falló la actualización de modelos.');
    }
  } else {
    toast(`Error: ${result?.error ?? 'JSON inválido'}`);
  }
}

async function switchActiveProvider(providerId) {
  if (typeof window.api.setActiveProvider !== 'function') {
    providersStatus.activeProvider = providerId;
    return true;
  }
  try {
    const result = await window.api.setActiveProvider(providerId);
    if (result?.ok === false) {
      toast(`Error: ${result.error ?? 'No se pudo cambiar el proveedor'}`);
      providerSelect.value = providersStatus.activeProvider ?? 'gemini';
      return false;
    }
    providersStatus.activeProvider = providerId;
    return true;
  } catch (e) {
    console.error('[switchActiveProvider]', e);
    toast(`Error: ${e.message ?? 'No se pudo cambiar el proveedor'}`);
    providerSelect.value = providersStatus.activeProvider ?? 'gemini';
    return false;
  }
}

providerSelect?.addEventListener('change', async () => {
  const providerId = providerSelect.value;
  if (!(await switchActiveProvider(providerId))) return;
  await loadModels();
  await refreshCredsStatus();
});

async function loadSavedPrompts() {
  try {
    const result = await window.api.listPrompts();
    if (result && typeof result === 'object' && Array.isArray(result.prompts)) {
      savedPrompts = result.prompts;
      if (!result.ok && result.error) toast(result.error);
    } else if (Array.isArray(result)) {
      savedPrompts = result;
    } else {
      savedPrompts = [];
    }
    renderSavedList();
  } catch (err) {
    console.error('[loadSavedPrompts]', err);
    savedPrompts = [];
    toast('Error al cargar los presets guardados.');
    renderSavedList();
  }
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
      try {
        const result = await window.api.deletePrompt(name);
        if (result?.ok === false) {
          toast(`Error: ${result.error ?? 'No se pudo eliminar'}`);
          return;
        }
        savedPrompts = result.prompts ?? [];
        renderSavedList();
        toast(`Eliminado: ${name}`);
      } catch (err) {
        console.error('[deletePrompt]', err);
        toast(`Error: ${err.message ?? 'No se pudo eliminar'}`);
      }
    });
  });
}

async function loadPreset(name) {
  const p = savedPrompts.find(x => x.name === name);
  if (!p) return;
  promptInput.value   = p.prompt ?? '';
  dataInput.value     = p.data   ?? '';
  saveNameInput.value = name;
  updateCounts();

  if (p.provider) {
    const opt = providerSelect.querySelector(`option[value="${CSS.escape(p.provider)}"]`);
    if (opt) {
      providerSelect.value = p.provider;
      if (!(await switchActiveProvider(p.provider))) return;
      await loadModels();
      await refreshCredsStatus();
    }
  }

  if (p.model) {
    const opt = modelSelect.querySelector(`option[value="${CSS.escape(p.model)}"]`);
    if (opt) modelSelect.value = p.model;
  }
  if (p.temperature != null) {
    tempRange.value       = p.temperature;
    tempValue.textContent = parseFloat(p.temperature).toFixed(1);
  }

  if (Array.isArray(p.responses) && p.responses.length) {
    responseHistory.length = 0;
    responseHistory.push(...p.responses);
    renderHistory();
  }

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

// ─── Ayuda de temperatura ───────────────────────────────────────────────────
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

  const provider    = getActiveProviderId();
  const model       = modelSelect.value;
  const prompt      = promptInput.value;
  const data        = dataInput.value;
  const temperature = parseFloat(tempRange.value);

  if (!model) { toast('Selecciona un modelo primero'); return; }

  const status = await getProvidersOverview();
  const pinfo = status.providers?.[provider];
  if (!isProviderConfigured(pinfo)) {
    toast(`Configura la API key de ${getProviderDef(provider).name} primero`);
    openCredsModal(provider);
    return;
  }

  isSending = true;
  sendLabel.classList.add('hidden');
  sendLoading.classList.remove('hidden');
  sendBtn.disabled = true;

  const placeholderId = `ph-${Date.now()}`;
  const placeholder   = document.createElement('div');
  placeholder.id        = placeholderId;
  placeholder.className = 'history-entry history-entry--loading';
  placeholder.innerHTML = `
    <div class="history-entry-head">
      <span class="history-badge history-badge--model">${esc(model)}</span>
      <span class="history-badge history-badge--temp">temp ${temperature.toFixed(1)}</span>
      <span class="history-ts">${fmtTime(new Date())}</span>
    </div>
    <div class="loading-block">
      <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      Procesando…
    </div>`;

  const empty = outputArea.querySelector('.output-empty');
  if (empty) empty.remove();
  outputArea.appendChild(placeholder);
  placeholder.scrollIntoView({ behavior: 'smooth', block: 'end' });

  const startMs = Date.now();

  try {
    const result = await callLLM({ provider, model, prompt, data, temperature });
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    placeholder.remove();

    if (result.ok) {
      lastRawText = result.text ?? '';
      const meta = { elapsed, usage: result.usage, cost: result.cost, finishReason: result.finishReason };
      responseHistory.push({ model, temperature, text: lastRawText, meta, ts: new Date().toISOString(), provider });
      renderHistory();

      if (result.usage) {
        const u = result.usage;
        tokenInfo.textContent  = `Tokens  entrada: ${u.promptTokenCount ?? '—'} · salida: ${u.candidatesTokenCount ?? u.completionTokenCount ?? '—'} · total: ${u.totalTokenCount ?? '—'}`;
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

      outputArea.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      const errEntry = document.createElement('div');
      errEntry.className = 'history-entry history-entry--error';
      errEntry.innerHTML = `<div class="error-block">❌ Error: ${esc(result.error ?? 'Error desconocido')}</div>`;
      outputArea.appendChild(errEntry);
    }
  } catch (err) {
    placeholder.remove();
    const errEntry = document.createElement('div');
    errEntry.className = 'history-entry history-entry--error';
    errEntry.innerHTML = `<div class="error-block">❌ Error inesperado: ${esc(err.message)}</div>`;
    outputArea.appendChild(errEntry);
  } finally {
    isSending = false;
    sendLabel.classList.remove('hidden');
    sendLoading.classList.add('hidden');
    sendBtn.disabled = false;
  }
}

// ─── History rendering ────────────────────────────────────────────────────────
function mdToHtml(text) {
  try {
    return (window.marked && typeof window.marked.parse === 'function')
      ? window.marked.parse(text)
      : `<pre style="white-space:pre-wrap;word-break:break-word">${esc(text)}</pre>`;
  } catch {
    return `<pre style="white-space:pre-wrap;word-break:break-word">${esc(text)}</pre>`;
  }
}

function renderHistory() {
  if (!responseHistory.length) {
    outputArea.innerHTML = `
      <div class="output-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <p>El resultado aparecerá aquí</p>
        <p class="hint">Ctrl+Enter para enviar</p>
      </div>`;
    return;
  }

  outputArea.innerHTML = responseHistory.map((entry, idx) => {
    const { model, temperature, text, meta, ts } = entry;
    const costStr   = meta?.cost != null ? ` · 💰 ${fmtCost(meta.cost)}` : '';
    const timeStr   = meta?.elapsed     ? ` · ⏱ ${meta.elapsed}s`        : '';
    const tokenStr  = meta?.usage
      ? ` · ${meta.usage.totalTokenCount ?? '—'} tokens`
      : '';
    const finStr    = meta?.finishReason ? ` · ${meta.finishReason}`      : '';
    const dateStr   = ts ? fmtTime(new Date(ts)) : '';
    const isLast    = idx === responseHistory.length - 1;

    return `
      <div class="history-entry${isLast ? ' history-entry--latest' : ''}">
        <div class="history-entry-head">
          <span class="history-badge history-badge--model">${esc(model)}</span>
          <span class="history-badge history-badge--temp">temp ${parseFloat(temperature).toFixed(1)}</span>
          <span class="history-entry-meta">${dateStr}${timeStr}${tokenStr}${costStr}${finStr}</span>
          <span class="history-entry-num">#${idx + 1}</span>
        </div>
        <div class="md-content history-md">${mdToHtml(text)}</div>
      </div>`;
  }).join('<div class="history-separator" aria-hidden="true"></div>');
}

sendBtn.addEventListener('click', sendRequest);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendRequest();
  }
});

// ─── Output toolbar ───────────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!responseHistory.length) { toast('No hay contenido para copiar'); return; }
  const all = responseHistory
    .map((e, i) => `## Respuesta #${i + 1} — ${e.model} (temp ${parseFloat(e.temperature).toFixed(1)})\n\n${e.text}`)
    .join('\n\n---\n\n');
  try {
    await navigator.clipboard.writeText(all);
    toast('Historial copiado al portapapeles');
  } catch (e) {
    console.error('[copyBtn]', e);
    toast('No se pudo copiar al portapapeles.');
  }
});

exportBtn.addEventListener('click', async () => {
  if (!responseHistory.length) { toast('No hay contenido para exportar'); return; }
  const all = responseHistory
    .map((e, i) => `## Respuesta #${i + 1} — ${e.model} (temp ${parseFloat(e.temperature).toFixed(1)})\n\n${e.text}`)
    .join('\n\n---\n\n');
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `historial-${ts}.md`;
  const res  = await window.api.saveOutputFile({ text: all, defaultName: name });
  if (res.ok)         toast(`Guardado: ${res.filePath.split(/[\\/]/).pop()}`);
  else if (res.error) toast(`Error: ${res.error}`);
});

clearOutputBtn.addEventListener('click', () => {
  lastRawText     = '';
  responseHistory.length = 0;
  sessionCostUSD  = 0;
  renderHistory();
  costInfo.textContent = '';
  sessionCostEl.textContent = '';
  sessionCostEl.classList.add('hidden');
  outputMeta.classList.add('hidden');
});

clearAllBtn.addEventListener('click', () => {
  promptInput.value   = '';
  dataInput.value     = '';
  saveNameInput.value = '';
  updateCounts();
  lastRawText     = '';
  responseHistory.length = 0;
  sessionCostUSD  = 0;
  renderHistory();
  costInfo.textContent = '';
  sessionCostEl.textContent = '';
  sessionCostEl.classList.add('hidden');
  outputMeta.classList.add('hidden');
  toast('Limpiado');
});

// ─── Save preset ──────────────────────────────────────────────────────────────
savePresetBtn.addEventListener('click', async () => {
  const name = saveNameInput.value.trim();
  if (!name) { toast('Escribe un nombre para el preset'); return; }

  try {
    const result = await window.api.savePrompt({
      name,
      prompt:      promptInput.value,
      data:        dataInput.value,
      provider:    getActiveProviderId(),
      model:       modelSelect.value,
      temperature: parseFloat(tempRange.value),
      responses:   responseHistory.slice(),
    });
    if (result?.ok === false) {
      toast(`Error: ${result.error ?? 'No se pudo guardar'}`);
      return;
    }
    savedPrompts = result.prompts ?? [];
    renderSavedList();
    toast(`Guardado: ${name}`);
  } catch (e) {
    console.error('[savePreset]', e);
    toast(`Error: ${e.message ?? 'No se pudo guardar'}`);
  }
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

// ─── Providers modal open/close ───────────────────────────────────────────────
function openCredsModal(providerId) {
  if (isTempHelpOpen()) closeTempHelp();
  if (providerId) switchModalProvider(providerId);
  else switchModalProvider(getActiveProviderId());
  const pasteArea = document.getElementById('creds-paste-area');
  if (pasteArea) pasteArea.value = '';
  credsModal.classList.remove('hidden');
  const firstInput = providersPanel.querySelector('.provider-panel.active .provider-input');
  if (firstInput) firstInput.focus();
  else providersSidebar.querySelector('.provider-tab.active')?.focus();
}

function closeCredsModal() {
  credsModal.classList.add('hidden');
}

credsBtn.addEventListener('click', () => openCredsModal());
credsCloseBtn.addEventListener('click', closeCredsModal);
credsBackdrop.addEventListener('click', closeCredsModal);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (isTempHelpOpen()) {
    closeTempHelp();
    return;
  }
  if (typeof window.__promptCoachHandleEscape === 'function' && window.__promptCoachHandleEscape()) {
    return;
  }
  closeCredsModal();
});

// Legacy alias for prompt-coach and external callers
function applyCredsUI(result) {
  if (result?.providers) {
    applyProviderStatusUI(result);
    return;
  }
  providersStatus = {
    activeProvider: 'gemini',
    providers: {
      gemini: result?.ok
        ? { configured: true, authMode: 'service-account', projectId: result.projectId, clientEmail: result.clientEmail }
        : { configured: false },
    },
  };
  applyProviderStatusUI(providersStatus);
}

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

function fmtTime(date) {
  if (!date || isNaN(date)) return '';
  try {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
window.promptTester = {
  responseHistory,
  promptInput,
  dataInput,
  modelSelect,
  providerSelect,
  tempRange,
  toast,
  openCredsModal,
  getActiveProviderId,
};
init().catch((e) => console.error('[init] No capturado:', e));
