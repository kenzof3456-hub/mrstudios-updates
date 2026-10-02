require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, session, desktopCapturer, screen, dialog, nativeImage } = require("electron");
const { loadProfile, saveProfile, address } = require("./src/profile");
const { createMemory } = require("./src/memory");
const { createMessenger } = require("./src/messenger");
const { createSight } = require("./src/sight");
const { handleTurn, greeting } = require("./src/brain");
const { isWindows } = require("./src/windows-apps");
const { parseWake } = require("./src/wake");
const { pickWakeLine, forSpeech, isEcho } = require("./src/spoken");
const { isJunkStt, looksLikeHearing } = require("./src/intents");
const { loadSecrets, saveApiKey } = require("./src/secrets");
const { cloudTts, sapiSpeak, edgeTts, listSapiVoices } = require("./src/tts");
const { JARVIS_TTS } = require("./src/jarvis-voice");
const { catalog, defaultVoiceChoice } = require("./src/voices");
const { localeFor, ttsVoiceFor } = require("./src/lang");

const { whisperTranscribe, windowsDictation } = require("./src/stt");
const { withTimeout } = require("./src/timeout");

process.on("uncaughtException", (err) => {
  console.error("uncaught", err && err.stack ? err.stack : err);
});
process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection", err);
});

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
  const savedKey = loadSecrets(userData).openaiApiKey;
  const llm = {
    apiKey: savedKey || process.env.OPENAI_API_KEY || "",
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
    apiKey: savedKey || process.env.OPENAI_API_KEY || "",
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

  function speechOpts(extra) {
    return {
      code: Boolean(extra && extra.code),
      search: Boolean(extra && extra.search),
      lang: profile.language || "es",
      who: address(profile),
    };
  }

  ipcMain.handle("jarvis:set-api-key", (_e, key) => {
    const saved = saveApiKey(userData, key);
    const next = saved.hasKey ? String(key || "").trim() : process.env.OPENAI_API_KEY || "";
    llm.apiKey = next;
    ttsCfg.apiKey = next;
    return { ok: true, hasLlm: Boolean(llm.apiKey) };
  });

  ipcMain.handle("jarvis:set-mic", (_e, deviceId) => {
    const micDeviceId = String(deviceId || "");
    profile = { ...profile, micDeviceId };
    saveProfile(userData, profile);
    return { ok: true, micDeviceId };
  });

  ipcMain.handle("jarvis:ear-check", (_e, payload) => {
    const text = String((payload && payload.text) || "");
    const last = String((payload && payload.last) || "");
    return {
      echo: isEcho(text, last),
      junk: isJunkStt(text),
      hearing: looksLikeHearing(text),
    };
  });

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
    try {
      const result = await withTimeout(
        handleTurn({
          text,
          history,
          profile,
          llm,
          memory,
          sight,
          messenger,
          useAttach: Boolean(payload?.useAttach),
          lowConfidence: Boolean(payload?.lowConfidence),
          setVoice,
          setLanguage,
          extraVoices: await extraVoices(),
          craftDir: path.join(userData, "craft"),
        }),
        14000,
        { reply: "Tardé de más, Señor. Prueba otra vez o escribe.", intent: "timeout" }
      );
      if (result && result.reply) return result;
      return { reply: "No encontré qué decir, Señor. Escribe otra vez.", intent: "empty" };
    } catch (err) {
      return { reply: "Fallo interno, Señor: " + (err.message || "error"), intent: "error" };
    }
  });

  ipcMain.handle("jarvis:transcribe", async (_e, payload) => {
    try {
      return await withTimeout(
        whisperTranscribe({
          apiKey: llm.apiKey,
          baseUrl: llm.baseUrl,
          audio: payload && payload.audio,
          mime: payload && payload.mime,
          language: (payload && payload.language) || "es",
        }),
        12000,
        { ok: false, reason: "timeout" }
      );
    } catch (err) {
      return { ok: false, reason: err.message || "transcribe" };
    }
  });

  ipcMain.handle("jarvis:windows-listen", async (_e, seconds) => {
    try {
      return await windowsDictation(seconds || 8);
    } catch (err) {
      return { ok: false, reason: err.message || "windows-stt" };
    }
  });

  ipcMain.handle("jarvis:wake-line", () => pickWakeLine(profile.language || "es"));

  ipcMain.handle("jarvis:parse-wake", (_e, text) => parseWake(text));

  ipcMain.handle("jarvis:speak", async (_e, payload) => {
    const raw = typeof payload === "string" ? payload : payload?.text || "";
    const opts = speechOpts(typeof payload === "object" ? payload : null);
    const spoken = forSpeech(raw, opts);
    const choice = ttsVoiceFor(profile);
    if (choice.engine === "openai") {
      const audio = await cloudTts({ ...ttsCfg, text: spoken, voice: choice.id, speech: { code: true } });
      if (audio) return { method: "cloud", audio, voice: choice.id, spoken };
    }
    if (choice.engine === "browser") {
      return { method: "browser", voice: choice.id, lang: choice.lang || "es-ES", spoken };
    }
    if (choice.engine === "sapi") {
      return { method: "local", sapiVoice: choice.id, spoken };
    }
    const preferred = choice.engine === "edge" ? choice.id : JARVIS_TTS.edgeVoices[0];
    const edge = await edgeTts(spoken, preferred, { code: true });
    if (edge && edge.audio) {
      return { method: "edge", audio: edge.audio, voice: edge.voice, spoken };
    }
    const audio = await cloudTts({ ...ttsCfg, text: spoken, voice: ttsCfg.voice, speech: { code: true } });
    if (audio) return { method: "cloud", audio, voice: ttsCfg.voice, spoken };
    return { method: "local", sapiVoice: choice.engine === "sapi" ? choice.id : "", spoken };
  });

  ipcMain.handle("jarvis:sapi", async (_e, payload) => {
    const text = typeof payload === "string" ? payload : payload?.text || "";
    const voiceName = typeof payload === "object" ? payload?.voice : "";
    const opts = speechOpts(typeof payload === "object" ? payload : null);
    const spoken = forSpeech(text, opts);
    return sapiSpeak(spoken, voiceName, { code: true });
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
