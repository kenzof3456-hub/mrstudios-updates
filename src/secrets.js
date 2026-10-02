const fs = require("fs");
const path = require("path");

function secretsPath(userDataDir) {
  return path.join(userDataDir, "secrets.json");
}

function loadSecrets(userDataDir) {
  try {
    const raw = fs.readFileSync(secretsPath(userDataDir), "utf8");
    const json = JSON.parse(raw);
    return { openaiApiKey: String((json && json.openaiApiKey) || "").trim() };
  } catch {
    return { openaiApiKey: "" };
  }
}

function saveApiKey(userDataDir, key) {
  const openaiApiKey = String(key || "").trim();
  fs.mkdirSync(userDataDir, { recursive: true });
  const file = secretsPath(userDataDir);
  if (!openaiApiKey) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* already gone */
    }
    return { ok: true, hasKey: false };
  }
  fs.writeFileSync(file, JSON.stringify({ openaiApiKey }, null, 2), { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* ignore */
  }
  return { ok: true, hasKey: true };
}

module.exports = { loadSecrets, saveApiKey, secretsPath };
