const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  getActiveProviderId,
  setActiveProviderId,
  setProviderSettings,
  getProviderSettings,
  maskApiKey,
} = require('./providers/config');
const {
  listProviderMeta,
  invalidateModelsCache,
  listModelsForProvider,
  callProvider,
  getProvider,
} = require('./providers/registry');
const {
  initPricing,
  refreshPricingOnOpen,
  calcCost,
  getPricingStatus,
} = require('./providers/pricing');

// ---------------------------------------------------------------------------
// Chromium / Windows: caché en disco y GPU
// ---------------------------------------------------------------------------
(function configureChromiumForWindows() {
  try {
    const cacheRoot = path.join(app.getPath('userData'), 'chromium-cache');
    fs.mkdirSync(cacheRoot, { recursive: true });
    app.setPath('cache', cacheRoot);
    const netCache = path.join(app.getPath('userData'), 'network-disk-cache');
    fs.mkdirSync(netCache, { recursive: true });
    app.commandLine.appendSwitch('disk-cache-dir', netCache);
  } catch (e) {
    console.warn('[prompt-tester] No se pudo configurar rutas de caché:', e.message);
  }
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
})();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function getDataPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {}
  return null;
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function buildProviderCtx(providerId) {
  return {
    settings: getProviderSettings(providerId),
    getDataPath,
    readJSON,
  };
}

// ---------------------------------------------------------------------------
// Pricing (refreshed on each app open via LiteLLM catalog)
// ---------------------------------------------------------------------------

function enrichResultWithCost(providerId, model, result) {
  if (!result.ok || result.cost != null) return result;
  const usage = result.usage;
  if (!usage) return result;
  const cost = calcCost(
    providerId,
    model,
    usage.promptTokenCount ?? 0,
    usage.candidatesTokenCount ?? 0,
  );
  return cost != null ? { ...result, cost } : result;
}

function getGeminiServiceAccountCreds() {
  return readJSON(getDataPath('credentials.json'));
}

function buildProviderStatusEntry(provider) {
  const ctx = buildProviderCtx(provider.id);
  const settings = ctx.settings;
  const entry = { configured: provider.isConfigured(ctx) };

  if (settings.apiKey?.trim()) {
    entry.maskedKey = maskApiKey(settings.apiKey);
    if (provider.id === 'gemini') entry.authMode = 'api-key';
  }

  if (provider.id === 'gemini') {
    const creds = getGeminiServiceAccountCreds();
    if (creds?.type === 'service_account' && !settings.apiKey?.trim()) {
      entry.configured = true;
      entry.authMode = 'service-account';
      entry.projectId = creds.project_id;
      entry.clientEmail = creds.client_email;
      entry.maskedKey = creds.project_id ?? maskApiKey(creds.client_email ?? '');
    }
  }

  if (settings.groupId?.trim()) entry.groupId = settings.groupId;

  return entry;
}

// ---------------------------------------------------------------------------
// Providers IPC
// ---------------------------------------------------------------------------

ipcMain.handle('providers:list', () => listProviderMeta());

ipcMain.handle('providers:status', () => {
  const providers = {};
  for (const meta of listProviderMeta()) {
    const provider = getProvider(meta.id);
    if (provider) providers[meta.id] = buildProviderStatusEntry(provider);
  }
  return { activeProvider: getActiveProviderId(), providers };
});

ipcMain.handle('providers:set-active', (_, providerId) => {
  if (!getProvider(providerId)) {
    return { ok: false, error: `Proveedor desconocido: ${providerId}` };
  }
  setActiveProviderId(providerId);
  return { ok: true, activeProvider: providerId };
});

ipcMain.handle('providers:save-key', (_, { providerId, apiKey, groupId }) => {
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, error: `Proveedor desconocido: ${providerId}` };

  const trimmed = (apiKey ?? '').trim();
  if (!trimmed) return { ok: false, error: 'API key vacía' };

  const settings = { apiKey: trimmed };
  if (groupId?.trim()) settings.groupId = groupId.trim();
  if (providerId === 'gemini') {
    settings.authMode = 'apiKey';
    const credPath = getDataPath('credentials.json');
    if (fs.existsSync(credPath)) fs.unlinkSync(credPath);
  }

  setProviderSettings(providerId, settings);
  invalidateModelsCache(providerId);
  return { ok: true, ...buildProviderStatusEntry(getProvider(providerId)) };
});

ipcMain.handle('providers:clear', (_, providerId) => {
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, error: `Proveedor desconocido: ${providerId}` };

  setProviderSettings(providerId, {});

  if (providerId === 'gemini') {
    const credPath = getDataPath('credentials.json');
    if (fs.existsSync(credPath)) fs.unlinkSync(credPath);
  }

  invalidateModelsCache(providerId);
  return { ok: true };
});

ipcMain.handle('pricing:status', () => getPricingStatus());

ipcMain.handle('pricing:refresh', async () => refreshPricingOnOpen());

// ---------------------------------------------------------------------------
// Legacy credentials IPC (Gemini service account)
// ---------------------------------------------------------------------------

ipcMain.handle('creds:status', () => {
  const gemini = getProvider('gemini');
  const entry = buildProviderStatusEntry(gemini);
  if (!entry.configured) return { ok: false };
  return {
    ok: true,
    projectId: entry.projectId,
    clientEmail: entry.clientEmail,
    authMode: entry.authMode,
    maskedKey: entry.maskedKey,
  };
});

ipcMain.handle('creds:select-file', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: 'Seleccionar Service Account JSON',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.[0]) return { ok: false };
  return saveCredentialsFromFile(filePaths[0]);
});

ipcMain.handle('creds:save-json', (_, jsonStr) => {
  try {
    const creds = JSON.parse(jsonStr);
    return validateAndSaveCredentials(creds);
  } catch (e) {
    return { ok: false, error: `JSON inválido: ${e.message}` };
  }
});

function saveCredentialsFromFile(filePath) {
  try {
    const creds = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return validateAndSaveCredentials(creds);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function validateAndSaveCredentials(creds) {
  if (creds.type !== 'service_account') {
    return { ok: false, error: 'No es un archivo de Service Account válido (falta "type":"service_account")' };
  }
  writeJSON(getDataPath('credentials.json'), creds);
  setProviderSettings('gemini', { authMode: 'serviceAccount', apiKey: '' });
  invalidateModelsCache('gemini');
  return {
    ok: true,
    projectId: creds.project_id,
    clientEmail: creds.client_email,
    authMode: 'service-account',
  };
}

ipcMain.handle('creds:clear', () => {
  try {
    setProviderSettings('gemini', {});
    const p = getDataPath('credentials.json');
    if (fs.existsSync(p)) fs.unlinkSync(p);
    invalidateModelsCache('gemini');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------------------------------------------------------------------------
// Models IPC
// ---------------------------------------------------------------------------

ipcMain.handle('models:list', (_, providerId) => {
  const id = providerId || getActiveProviderId();
  const provider = getProvider(id);
  if (!provider) return [];
  return listModelsForProvider(id, getDataPath, readJSON);
});

// ---------------------------------------------------------------------------
// LLM IPC (multi-provider)
// ---------------------------------------------------------------------------

ipcMain.handle('llm:call', async (_, { provider, model, prompt, data, temperature }) => {
  const providerId = provider || getActiveProviderId();
  const result = await callProvider(providerId, { model, prompt, data, temperature }, getDataPath, readJSON);
  return enrichResultWithCost(providerId, model, result);
});

ipcMain.handle('gemini:call', async (_, args) => {
  const result = await callProvider('gemini', args, getDataPath, readJSON);
  return enrichResultWithCost('gemini', args.model, result);
});

// ---------------------------------------------------------------------------
// Output export IPC
// ---------------------------------------------------------------------------

ipcMain.handle('output:save-file', async (_, { text, defaultName }) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Guardar resultado',
    defaultPath: defaultName ?? 'resultado.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Texto', extensions: ['txt'] },
    ],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, text, 'utf-8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------------------------------------------------------------------------
// Saved Prompts IPC
// ---------------------------------------------------------------------------

ipcMain.handle('prompts:list', () => readJSON(getDataPath('saved-prompts.json')) ?? []);

ipcMain.handle('prompts:save', (_, { name, prompt, data, model, provider, temperature, responses }) => {
  const saved = readJSON(getDataPath('saved-prompts.json')) ?? [];
  const idx = saved.findIndex(p => p.name === name);
  const entry = {
    name,
    prompt,
    data,
    provider:    provider    ?? getActiveProviderId(),
    model:       model       ?? null,
    temperature: temperature ?? null,
    responses:   Array.isArray(responses) ? responses : [],
    updatedAt:   new Date().toISOString(),
  };
  if (idx >= 0) saved[idx] = entry;
  else saved.push(entry);
  writeJSON(getDataPath('saved-prompts.json'), saved);
  return saved;
});

ipcMain.handle('prompts:delete', (_, name) => {
  const saved = (readJSON(getDataPath('saved-prompts.json')) ?? []).filter(p => p.name !== name);
  writeJSON(getDataPath('saved-prompts.json'), saved);
  return saved;
});

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 650,
    title: 'Prompt Tester',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  initPricing({ getDataPath, readJSON, writeJSON });
  createWindow();
  refreshPricingOnOpen().catch(() => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
