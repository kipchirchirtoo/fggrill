const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('famousGates', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  isElectron: true,
});
