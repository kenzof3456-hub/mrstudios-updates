require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, session, desktopCapturer, screen, dialog, nativeImage } = require("electron");
const { loadProfile, saveProfile } = require("./src/profile");
const { createMemory } = require("./src/memory");
const { createMessenger } = require("./src/messenger");
const { createSight } = require("./src/sight");
const { handleTurn, greeting } = require("./src/brain");
const { isWindows } = require("./src/windows-apps");
const { parseWake } = require("./src/wake");
const { pickWakeLine } = require("./src/spoken");
const { cloudTts, sapiSpeak, edgeTts, listSapiVoices } = require("./src/tts");
const { JARVIS_TTS } = require("./src/jarvis-voice");
const { catalog, defaultVoiceChoice } = require("./src/voices");
const { localeFor, ttsVoiceFor } = require("./src/lang");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-features", "PreloadMediaEngagementData");

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
  if (typeof session.defaultSession.setDevicePermissionHandler === "function") {
    session.defaultSession.setDevicePermissionHandler(() => true);
  }

  const userData = app.getPath("userData");
  let profile = loadProfile(userData);
  if (!profile.voice || !profile.voice.id) {
    profile = { ...profile, voice: defaultVoiceChoice() };
    saveProfile(userData, profile);
  }
  const memory = createMemory(path.join(userData, "memory.json"));
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
  const messenger = createMessenger({ memory });
  const ttsCfg = {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    voice: process.env.OPENAI_TTS_VOICE || JARVIS_TTS.openaiVoice,
    model: process.env.OPENAI_TTS_MODEL || JARVIS_TTS.openaiModel,
  };

  let browserVoices = [];

  function setLanguage(code) {
    const language = String(code || "es");
    if (profile.language === language) return;
    profile = { ...profile, language, locale: localeFor(language) };
    saveProfile(userData, profile);
  }

  function setVoice(choice) {
    profile = { ...profile, voice: choice };
    saveProfile(userData, profile);
    memory.add(`para hablar usa ${choice.label} (${choice.engine})`);
    return profile.voice;
  }

  async function extraVoices() {
    const sapi = await listSapiVoices();
    return [...sapi, ...browserVoices];
  }

  ipcMain.handle("jarvis:status", () => ({
    profile,
    isWindows,
    hasLlm: Boolean(llm.apiKey),
    hasCloudTts: Boolean(ttsCfg.apiKey),
    ttsVoice: (ttsVoiceFor(profile) && ttsVoiceFor(profile).id) || JARVIS_TTS.edgeVoices[0],
    greeting: greeting(profile, memory),
  }));

  ipcMain.handle("jarvis:voices", async () => ({
    current: profile.voice || defaultVoiceChoice(),
    list: catalog(await extraVoices()),
  }));

  ipcMain.handle("jarvis:set-voice", (_e, choice) => {
    if (!choice || !choice.id) return { ok: false };
    const voice = {
      engine: choice.engine || "edge",
      id: String(choice.id),
      label: String(choice.label || choice.id),
      lang: choice.lang || "",
      gender: choice.gender || "",
    };
    setVoice(voice);
    return { ok: true, voice };
  });

  ipcMain.handle("jarvis:browser-voices", (_e, list) => {
    browserVoices = (Array.isArray(list) ? list : []).map((v) => ({
      engine: "browser",
      id: v.name || v.id,
      label: v.name || v.id,
      lang: v.lang || "",
      gender: "",
    }));
    return { ok: true, n: browserVoices.length };
  });

  ipcMain.handle("jarvis:pick-file", async () => {
    const win = BrowserWindow.getAllWindows()[0];
    const picked = await dialog.showOpenDialog(win || undefined, {
      title: "Adjuntar para Jarvis",
      properties: ["openFile"],
      filters: [
        {
          name: "Fotos y documentos",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "txt", "md", "csv", "json", "log", "mp3", "wav", "m4a"],
        },
        { name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] },
        { name: "Todos", extensions: ["*"] },
      ],
    });
    if (picked.canceled || !picked.filePaths[0]) {
      return { ok: false, cancelled: true };
    }
    try {
      const ingested = sight.ingestPath(picked.filePaths[0]);
      let preview = "";
      if (ingested.kind === "image") {
        try {
          const img = nativeImage.createFromPath(ingested.path);
          if (!img.isEmpty()) preview = img.resize({ width: 128 }).toDataURL();
        } catch {
          preview = ingested.dataUrl && ingested.dataUrl.length < 280000 ? ingested.dataUrl : "";
        }
      }
      return {
        ok: true,
        name: ingested.name,
        kind: ingested.kind,
        preview,
      };
    } catch (err) {
      const code = String(err.message || err);
      const detail =
        code === "too-large"
          ? "Ese archivo pesa de más (máx. 12 MB)."
          : "No pude copiar el archivo.";
      return { ok: false, error: detail };
    }
  });

  ipcMain.handle("jarvis:chat", async (_evt, payload) => {
    const text = String(payload?.text || "");
    const history = Array.isArray(payload?.history) ? payload.history : [];
    return handleTurn({
      text,
      history,
      profile,
      llm,
      memory,
      sight,
      messenger,
      useAttach: Boolean(payload?.useAttach),
      setVoice,
      setLanguage,
      extraVoices: await extraVoices(),
      craftDir: path.join(userData, "craft"),
    });
  });

  ipcMain.handle("jarvis:wake-line", () => pickWakeLine(profile.language || "es"));

  ipcMain.handle("jarvis:parse-wake", (_e, text) => parseWake(text));

  ipcMain.handle("jarvis:speak", async (_e, text) => {
    const spoken = String(text || "");
    const choice = ttsVoiceFor(profile);
    if (choice.engine === "openai") {
      const audio = await cloudTts({ ...ttsCfg, text: spoken, voice: choice.id });
      if (audio) return { method: "cloud", audio, voice: choice.id };
    }
    if (choice.engine === "browser") {
      return { method: "browser", voice: choice.id, lang: choice.lang || "es-ES" };
    }
    if (choice.engine === "sapi") {
      return { method: "local", sapiVoice: choice.id };
    }
    const preferred = choice.engine === "edge" ? choice.id : JARVIS_TTS.edgeVoices[0];
    const edge = await edgeTts(spoken, preferred);
    if (edge && edge.audio) {
      return { method: "edge", audio: edge.audio, voice: edge.voice };
    }
    const audio = await cloudTts({ ...ttsCfg, text: spoken, voice: ttsCfg.voice });
    if (audio) return { method: "cloud", audio, voice: ttsCfg.voice };
    return { method: "local", sapiVoice: choice.engine === "sapi" ? choice.id : "" };
  });

  ipcMain.handle("jarvis:sapi", async (_e, payload) => {
    const text = typeof payload === "string" ? payload : payload?.text || "";
    const voiceName = typeof payload === "object" ? payload?.voice : "";
    return sapiSpeak(text, voiceName);
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
