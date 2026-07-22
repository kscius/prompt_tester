const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  getActiveProviderId,
  setActiveProviderId,
  setProviderSettings,
  clearProviderSettings,
  getProviderSettings,
  maskApiKey,
  getProviderConfigHealth,
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
const {
  inspectCredentialsFile,
  validateServiceAccountFields,
} = require('./providers/credentials-store');
const {
  inspectSavedPromptsFile,
  assertSavedPromptsWritable,
} = require('./providers/saved-prompts');

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
  } catch (e) {
    console.warn(`[readJSON] No se pudo leer ${path.basename(filePath)}:`, e.message);
  }
  return null;
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    const err = new Error(`No se pudo guardar ${path.basename(filePath)}: ${e.message}`);
    err.cause = e;
    throw err;
  }
}

function buildProviderCtx(providerId) {
  return {
    settings: getProviderSettings(providerId),
    getDataPath,
    readJSON,
    fileExists: fs.existsSync,
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

function inspectCredentials() {
  const filePath = getDataPath('credentials.json');
  return inspectCredentialsFile(readJSON, filePath, fs.existsSync);
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
    const inspection = inspectCredentials();
    if (inspection.corrupt) {
      entry.configured = false;
      entry.credentialsCorrupt = true;
      entry.error = inspection.error;
    } else {
      const creds = inspection.creds;
      if (creds?.type === 'service_account' && !settings.apiKey?.trim()) {
        entry.configured = true;
        entry.authMode = 'service-account';
        entry.projectId = creds.project_id;
        entry.clientEmail = creds.client_email;
        entry.maskedKey = creds.project_id ?? maskApiKey(creds.client_email ?? '');
      }
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
  const configHealth = getProviderConfigHealth();
  return {
    activeProvider: getActiveProviderId(),
    providers,
    configCorrupt: Boolean(configHealth.corrupt),
    configError: configHealth.corrupt ? configHealth.error : undefined,
  };
});

ipcMain.handle('providers:set-active', (_, providerId) => {
  if (!getProvider(providerId)) {
    return { ok: false, error: `Proveedor desconocido: ${providerId}` };
  }
  try {
    setActiveProviderId(providerId);
    return { ok: true, activeProvider: providerId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('providers:save-key', (_, { providerId, apiKey, groupId }) => {
  try {
    const provider = getProvider(providerId);
    if (!provider) return { ok: false, error: `Proveedor desconocido: ${providerId}` };

    const trimmed = (apiKey ?? '').trim();
    if (!trimmed) return { ok: false, error: 'API key vacía' };

    const settings = { apiKey: trimmed };
    // MiniMax: always apply groupId from the payload so an empty field clears
    // a previously saved Group-Id (setProviderSettings treats null as delete).
    if (providerId === 'minimax' && groupId !== undefined) {
      const trimmedGroup = String(groupId ?? '').trim();
      settings.groupId = trimmedGroup || null;
    } else if (groupId?.trim()) {
      settings.groupId = groupId.trim();
    }
    if (providerId === 'gemini') {
      settings.authMode = 'apiKey';
      const credPath = getDataPath('credentials.json');
      if (fs.existsSync(credPath)) fs.unlinkSync(credPath);
    }

    setProviderSettings(providerId, settings);
    invalidateModelsCache(providerId);
    return { ok: true, ...buildProviderStatusEntry(getProvider(providerId)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('providers:clear', (_, providerId) => {
  try {
    const provider = getProvider(providerId);
    if (!provider) return { ok: false, error: `Proveedor desconocido: ${providerId}` };

    clearProviderSettings(providerId);

    if (providerId === 'gemini') {
      const credPath = getDataPath('credentials.json');
      if (fs.existsSync(credPath)) fs.unlinkSync(credPath);
    }

    invalidateModelsCache(providerId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('pricing:status', () => getPricingStatus());

ipcMain.handle('pricing:refresh', async () => refreshPricingOnOpen());

// ---------------------------------------------------------------------------
// Legacy credentials IPC (Gemini service account)
// ---------------------------------------------------------------------------

ipcMain.handle('creds:status', () => {
  const gemini = getProvider('gemini');
  const entry = buildProviderStatusEntry(gemini);
  if (entry.credentialsCorrupt) {
    return { ok: false, credentialsCorrupt: true, error: entry.error };
  }
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
  const validationError = validateServiceAccountFields(creds);
  if (validationError) {
    return { ok: false, error: validationError };
  }
  try {
    writeJSON(getDataPath('credentials.json'), creds);
    setProviderSettings('gemini', { authMode: 'serviceAccount', apiKey: '' });
    invalidateModelsCache('gemini');
    return {
      ok: true,
      projectId: creds.project_id,
      clientEmail: creds.client_email,
      authMode: 'service-account',
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('creds:clear', () => {
  try {
    clearProviderSettings('gemini');
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
  if (!provider) return { models: [], warning: null };
  return listModelsForProvider(id, getDataPath, readJSON, fs.existsSync);
});

// ---------------------------------------------------------------------------
// LLM IPC (multi-provider)
// ---------------------------------------------------------------------------

ipcMain.handle('llm:call', async (_, { provider, model, prompt, data, temperature }) => {
  const providerId = provider || getActiveProviderId();
  const result = await callProvider(providerId, { model, prompt, data, temperature }, getDataPath, readJSON, fs.existsSync);
  return enrichResultWithCost(providerId, model, result);
});

ipcMain.handle('gemini:call', async (_, args) => {
  const result = await callProvider('gemini', args, getDataPath, readJSON, fs.existsSync);
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

function inspectSavedPrompts() {
  const filePath = getDataPath('saved-prompts.json');
  return inspectSavedPromptsFile(readJSON, filePath, fs.existsSync);
}

ipcMain.handle('prompts:list', () => inspectSavedPrompts());

ipcMain.handle('prompts:save', (_, { name, prompt, data, model, provider, temperature, responses }) => {
  try {
    const inspection = inspectSavedPrompts();
    assertSavedPromptsWritable(inspection);
    const saved = [...inspection.prompts];
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
    return { ok: true, prompts: saved };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('prompts:delete', (_, name) => {
  try {
    const inspection = inspectSavedPrompts();
    assertSavedPromptsWritable(inspection);
    const saved = inspection.prompts.filter(p => p.name !== name);
    writeJSON(getDataPath('saved-prompts.json'), saved);
    return { ok: true, prompts: saved };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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
