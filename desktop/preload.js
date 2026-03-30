const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeConsole', {
  getStatus: () => ipcRenderer.invoke('bridge:get-status'),
  start: () => ipcRenderer.invoke('bridge:start'),
  stop: () => ipcRenderer.invoke('bridge:stop'),
  restart: () => ipcRenderer.invoke('bridge:restart'),
  diagnostics: () => ipcRenderer.invoke('bridge:diagnostics'),
  healthCheck: () => ipcRenderer.invoke('bridge:health-check'),
  openConfigDir: () => ipcRenderer.invoke('bridge:open-config-dir'),
  openEnvFile: () => ipcRenderer.invoke('bridge:open-env-file'),
  reloadConfig: () => ipcRenderer.invoke('bridge:reload-config'),
  saveConfig: (payload) => ipcRenderer.invoke('bridge:save-config', payload),
  clearLogs: () => ipcRenderer.invoke('bridge:clear-logs'),
  clearRequests: () => ipcRenderer.invoke('bridge:clear-requests'),
  onStatus: (handler) => ipcRenderer.on('bridge:status', (_event, payload) => handler(payload)),
  onLog: (handler) => ipcRenderer.on('bridge:log', (_event, payload) => handler(payload)),
  onEvent: (handler) => ipcRenderer.on('bridge:event', (_event, payload) => handler(payload)),
  onRequest: (handler) => ipcRenderer.on('bridge:request', (_event, payload) => handler(payload)),
});
