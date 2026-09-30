const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  status: () => ipcRenderer.invoke("jarvis:status"),
  chat: (text, history) => ipcRenderer.invoke("jarvis:chat", { text, history }),
  wakeLine: () => ipcRenderer.invoke("jarvis:wake-line"),
  parseWake: (text) => ipcRenderer.invoke("jarvis:parse-wake", text),
  speakPlan: (text) => ipcRenderer.invoke("jarvis:speak", text),
  sapi: (text) => ipcRenderer.invoke("jarvis:sapi", text),
});
