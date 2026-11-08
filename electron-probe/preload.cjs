'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopAPI', {
  appInfo: ipcRenderer.sendSync('probe:bootstrap'),
  ping: (value) => ipcRenderer.invoke('probe:ping', value),
  report: (result) => ipcRenderer.invoke('probe:report', result)
});
