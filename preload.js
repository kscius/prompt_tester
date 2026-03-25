const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Credentials
  getCredsStatus:  ()      => ipcRenderer.invoke('creds:status'),
  selectCredsFile: ()      => ipcRenderer.invoke('creds:select-file'),
  saveCredsJson:   (json)  => ipcRenderer.invoke('creds:save-json', json),
  clearCreds:      ()      => ipcRenderer.invoke('creds:clear'),

  // Models
  getModels: () => ipcRenderer.invoke('models:list'),

  // Gemini API call
  callGemini: (args) => ipcRenderer.invoke('gemini:call', args),

  // Saved Prompts
  listPrompts:  ()     => ipcRenderer.invoke('prompts:list'),
  savePrompt:   (args) => ipcRenderer.invoke('prompts:save', args),
  deletePrompt: (name) => ipcRenderer.invoke('prompts:delete', name),

  // Output export
  saveOutputFile: (args) => ipcRenderer.invoke('output:save-file', args),
});
