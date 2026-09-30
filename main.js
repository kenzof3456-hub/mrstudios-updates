require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, session, desktopCapturer, screen } = require("electron");
const { loadProfile } = require("./src/profile");
const { createMemory } = require("./src/memory");
const { createSight } = require("./src/sight");
const { handleTurn, greeting } = require("./src/brain");
const { isWindows } = require("./src/windows-apps");
const { parseWake } = require("./src/wake");
const { pickWakeLine } = require("./src/spoken");
const { cloudTts, sapiSpeak } = require("./src/tts");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

async function capturePrimary(filePath) {
  const primary = screen.getPrimaryDisplay();
  const factor = primary.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.min(1600, Math.round(primary.size.width * factor)),
      height: Math.min(900, Math.round(primary.size.height * factor)),
    },
  });
  const src =
    sources.find((s) => String(s.display_id) === String(primary.id)) || sources[0];
  if (!src || src.thumbnail.isEmpty()) {
    throw new Error("no-screen");
  }
  const png = src.thumbnail.toPNG();
  fs.writeFileSync(filePath, png);
  return {
    path: filePath,
    dataUrl: "data:image/png;base64," + png.toString("base64"),
  };
}

async function captureUserScreen(filePath) {
  const win = BrowserWindow.getAllWindows()[0];
  const wasVisible = win && win.isVisible();
  try {
    if (win && wasVisible) win.hide();
    await new Promise((r) => setTimeout(r, 280));
    return await capturePrimary(filePath);
  } finally {
    if (win && wasVisible) win.show();
  }
}

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
    ["media", "microphone", "audioCapture", "display-capture"].includes(permission)
  );

  const profile = loadProfile(app.getPath("userData"));
  const memory = createMemory(path.join(app.getPath("userData"), "memory.json"));
  const llm = {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    visionModel: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
  const sight = createSight({
    dir: app.getPath("userData"),
    captureFn: captureUserScreen,
    llm,
  });
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
    return handleTurn({ text, history, profile, llm, memory, sight });
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
