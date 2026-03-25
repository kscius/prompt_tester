const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Chromium / Windows: caché en disco y GPU (evita "Access denied", Gpu Cache
// Creation failed). Debe ir antes de app.ready — setPath + commandLine.
// Una sola instancia evita que dos procesos peleen por los mismos archivos.
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

// ---------------------------------------------------------------------------
// Available models
// ---------------------------------------------------------------------------

const MODELS = [
  { id: 'gemini-2.5-flash-lite-preview-09-2025', label: 'Gemini 2.5 Flash Lite Preview (09-2025)' },
  { id: 'gemini-2.5-flash',                       label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash-001',                   label: 'Gemini 2.0 Flash (001)' },
  { id: 'gemini-2.0-flash-lite-001',              label: 'Gemini 2.0 Flash Lite (001)' },
  { id: 'gemini-1.5-flash-002',                   label: 'Gemini 1.5 Flash (002)' },
  { id: 'gemini-1.5-pro-002',                     label: 'Gemini 1.5 Pro (002)' },
];

// ---------------------------------------------------------------------------
// Pricing (USD per 1M tokens – source: Google AI Studio pricing, Jan 2026)
// Preview/experimental models may be free or change; values are estimates.
// ---------------------------------------------------------------------------

const MODEL_PRICING = {
  'gemini-2.5-flash-lite-preview-09-2025': { inputPerM: 0.075,   outputPerM: 0.30  },
  'gemini-2.5-flash':                       { inputPerM: 0.30,    outputPerM: 2.50  },
  'gemini-2.0-flash-001':                   { inputPerM: 0.075,   outputPerM: 0.30  },
  'gemini-2.0-flash-lite-001':              { inputPerM: 0.0375,  outputPerM: 0.15  },
  'gemini-1.5-flash-002':                   { inputPerM: 0.075,   outputPerM: 0.30  },
  'gemini-1.5-pro-002':                     { inputPerM: 1.25,    outputPerM: 5.00  },
};

function calcCost(modelId, promptTokens, candidateTokens) {
  const p = MODEL_PRICING[modelId];
  if (!p || !promptTokens) return null;
  return ((promptTokens    / 1_000_000) * p.inputPerM)
       + ((candidateTokens / 1_000_000) * p.outputPerM);
}

// ---------------------------------------------------------------------------
// Credentials IPC
// ---------------------------------------------------------------------------

ipcMain.handle('creds:status', () => {
  const creds = readJSON(getDataPath('credentials.json'));
  if (!creds) return { ok: false };
  return { ok: true, projectId: creds.project_id, clientEmail: creds.client_email };
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

ipcMain.handle('creds:clear', () => {
  try {
    const p = getDataPath('credentials.json');
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
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
  return { ok: true, projectId: creds.project_id, clientEmail: creds.client_email };
}

// ---------------------------------------------------------------------------
// Models IPC
// ---------------------------------------------------------------------------

ipcMain.handle('models:list', () => MODELS);

// ---------------------------------------------------------------------------
// Gemini API IPC
// ---------------------------------------------------------------------------

ipcMain.handle('gemini:call', async (_, { model, prompt, data, temperature }) => {
  const creds = readJSON(getDataPath('credentials.json'));
  if (!creds) return { ok: false, error: 'Sin credenciales configuradas. Configúralas en el botón de credenciales.' };

  try {
    // Dynamic import handles both CJS and ESM builds of google-auth-library
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

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: data || '' }] }],
      generationConfig: { maxOutputTokens: 65535, temperature: temperature ?? 1, topP: 0.95 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT',         threshold: 'OFF' },
      ],
    };

    if (prompt?.trim()) {
      requestBody.systemInstruction = { parts: [{ text: prompt }] };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errBody}` };
    }

    const json = await res.json();

    const finishReason = json.candidates?.[0]?.finishReason;
    let text = '';
    if (json.candidates?.[0]?.content?.parts) {
      text = json.candidates[0].content.parts.map(p => p.text || '').join('');
    }

    const usage = json.usageMetadata ?? null;
    const cost  = calcCost(model, usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0);
    return { ok: true, text, finishReason, usage, cost };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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
      { name: 'Texto',    extensions: ['txt'] },
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

ipcMain.handle('prompts:save', (_, { name, prompt, data }) => {
  const saved = readJSON(getDataPath('saved-prompts.json')) ?? [];
  const idx = saved.findIndex(p => p.name === name);
  const entry = { name, prompt, data, updatedAt: new Date().toISOString() };
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
