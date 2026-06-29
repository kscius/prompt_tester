const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Multi-provider
  listProviders:       ()           => ipcRenderer.invoke('providers:list'),
  getProvidersStatus:  ()           => ipcRenderer.invoke('providers:status'),
  setActiveProvider:   (providerId) => ipcRenderer.invoke('providers:set-active', providerId),
  saveProviderApiKey:  (args)       => ipcRenderer.invoke('providers:save-key', args),
  clearProvider:       (providerId) => ipcRenderer.invoke('providers:clear', providerId),
  getModels:           (providerId) => ipcRenderer.invoke('models:list', providerId),
  callLLM:             (args)       => ipcRenderer.invoke('llm:call', args),

  // Pricing (refreshed on app open)
  getPricingStatus:    ()           => ipcRenderer.invoke('pricing:status'),
  refreshPricing:      ()           => ipcRenderer.invoke('pricing:refresh'),

  // Legacy credentials (Gemini service account)
  getCredsStatus:  ()      => ipcRenderer.invoke('creds:status'),
  selectCredsFile: ()      => ipcRenderer.invoke('creds:select-file'),
  saveCredsJson:   (json)  => ipcRenderer.invoke('creds:save-json', json),
  clearCreds:      ()      => ipcRenderer.invoke('creds:clear'),

  // Legacy Gemini call alias
  callGemini: (args) => ipcRenderer.invoke('gemini:call', args),

  // Saved Prompts
  listPrompts:  ()     => ipcRenderer.invoke('prompts:list'),
  savePrompt:   (args) => ipcRenderer.invoke('prompts:save', args),
  deletePrompt: (name) => ipcRenderer.invoke('prompts:delete', name),

  // Output export
  saveOutputFile: (args) => ipcRenderer.invoke('output:save-file', args),
});
