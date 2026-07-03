// Exposes exactly one native capability to the web app: "save this project into a folder I
// pick". The web app feature-detects `window.vibexDesktop` to show the desktop-only action.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vibexDesktop", {
  version: "0.1.0",
  saveProject: (payload) => ipcRenderer.invoke("vibex:save-project", payload),
});
