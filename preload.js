const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  status: () => ipcRenderer.invoke("jarvis:status"),
  chat: (text, history, extra) =>
    ipcRenderer.invoke("jarvis:chat", {
      text,
      history,
      useAttach: Boolean(extra && extra.useAttach),
    }),
  pickFile: () => ipcRenderer.invoke("jarvis:pick-file"),
  voices: () => ipcRenderer.invoke("jarvis:voices"),
  setVoice: (choice) => ipcRenderer.invoke("jarvis:set-voice", choice),
  reportBrowserVoices: (list) => ipcRenderer.invoke("jarvis:browser-voices", list),
  wakeLine: () => ipcRenderer.invoke("jarvis:wake-line"),
  parseWake: (text) => ipcRenderer.invoke("jarvis:parse-wake", text),
  speakPlan: (text) => ipcRenderer.invoke("jarvis:speak", text),
  sapi: (text, voice) => ipcRenderer.invoke("jarvis:sapi", { text, voice }),
});
