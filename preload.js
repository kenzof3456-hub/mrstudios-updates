const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  status: () => ipcRenderer.invoke("jarvis:status"),
  chat: (text, history, extra) =>
    ipcRenderer.invoke("jarvis:chat", {
      text,
      history,
      useAttach: Boolean(extra && extra.useAttach),
      lowConfidence: Boolean(extra && extra.lowConfidence),
    }),
  setApiKey: (key) => ipcRenderer.invoke("jarvis:set-api-key", key),
  setMic: (deviceId) => ipcRenderer.invoke("jarvis:set-mic", deviceId),
  earCheck: (payload) => ipcRenderer.invoke("jarvis:ear-check", payload),
  pickFile: () => ipcRenderer.invoke("jarvis:pick-file"),
  voices: () => ipcRenderer.invoke("jarvis:voices"),
  setVoice: (choice) => ipcRenderer.invoke("jarvis:set-voice", choice),
  reportBrowserVoices: (list) => ipcRenderer.invoke("jarvis:browser-voices", list),
  wakeLine: () => ipcRenderer.invoke("jarvis:wake-line"),
  parseWake: (text) => ipcRenderer.invoke("jarvis:parse-wake", text),
  speakPlan: (payload) => ipcRenderer.invoke("jarvis:speak", payload),
  sapi: (text, voice, extra) =>
    ipcRenderer.invoke("jarvis:sapi", { text, voice, ...(extra || {}) }),
  transcribe: (audio, mime, language) =>
    ipcRenderer.invoke("jarvis:transcribe", { audio, mime, language }),
  windowsListen: (seconds) => ipcRenderer.invoke("jarvis:windows-listen", seconds),
});
