const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  status: () => ipcRenderer.invoke("jarvis:status"),
  chat: (text, history) => ipcRenderer.invoke("jarvis:chat", { text, history }),
});
