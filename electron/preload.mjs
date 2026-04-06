import { createRequire } from "node:module";
const { contextBridge, ipcRenderer } = createRequire(import.meta.url)("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  restartServer: () => ipcRenderer.invoke("settings:restart-server"),
});
