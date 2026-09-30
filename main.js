require("dotenv").config();
const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { loadProfile } = require("./src/profile");
const { handleTurn, greeting } = require("./src/brain");
const { isWindows } = require("./src/windows-apps");

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 740,
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
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  const profile = loadProfile(app.getPath("userData"));
  const llm = {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };

  ipcMain.handle("jarvis:status", () => ({
    profile,
    isWindows,
    hasLlm: Boolean(llm.apiKey),
    greeting: greeting(profile),
  }));

  ipcMain.handle("jarvis:chat", async (_evt, payload) => {
    const text = String(payload?.text || "");
    const history = Array.isArray(payload?.history) ? payload.history : [];
    return handleTurn({ text, history, profile, llm });
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
