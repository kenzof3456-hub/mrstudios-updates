require("dotenv").config();
const path = require("path");
const { app, BrowserWindow, ipcMain, session } = require("electron");
const { loadProfile } = require("./src/profile");
const { createMemory } = require("./src/memory");
const { handleTurn, greeting } = require("./src/brain");
const { isWindows } = require("./src/windows-apps");
const { parseWake } = require("./src/wake");
const { pickWakeLine } = require("./src/spoken");
const { cloudTts, sapiSpeak } = require("./src/tts");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: "#05080d",
    title: "J.A.R.V.I.S.",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["media", "microphone", "audioCapture", "display-capture"].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    ["media", "microphone", "audioCapture"].includes(permission)
  );

  const profile = loadProfile(app.getPath("userData"));
  const memory = createMemory(path.join(app.getPath("userData"), "memory.json"));
  const llm = {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
  const ttsCfg = {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    voice: process.env.OPENAI_TTS_VOICE || "nova",
    model: process.env.OPENAI_TTS_MODEL || "tts-1",
  };

  ipcMain.handle("jarvis:status", () => ({
    profile,
    isWindows,
    hasLlm: Boolean(llm.apiKey),
    hasCloudTts: Boolean(ttsCfg.apiKey),
    greeting: greeting(profile, memory),
  }));

  ipcMain.handle("jarvis:chat", async (_evt, payload) => {
    const text = String(payload?.text || "");
    const history = Array.isArray(payload?.history) ? payload.history : [];
    return handleTurn({ text, history, profile, llm, memory });
  });

  ipcMain.handle("jarvis:wake-line", () => pickWakeLine());

  ipcMain.handle("jarvis:parse-wake", (_e, text) => parseWake(text));

  ipcMain.handle("jarvis:speak", async (_e, text) => {
    const audio = await cloudTts({ ...ttsCfg, text: String(text || "") });
    if (audio) return { method: "cloud", audio };
    return { method: "local" };
  });

  ipcMain.handle("jarvis:sapi", async (_e, text) => sapiSpeak(String(text || "")));

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
