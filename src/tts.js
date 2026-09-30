const https = require("https");
const { URL } = require("url");
const { execFile } = require("child_process");
const { forSpeech } = require("./spoken");

function cloudTts({ apiKey, baseUrl, text, voice, model }) {
  if (!apiKey) return Promise.resolve(null);
  const spoken = forSpeech(text);
  if (!spoken) return Promise.resolve(null);
  const root = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = new URL(`${root}/audio/speech`);
  const body = JSON.stringify({
    model: model || "tts-1",
    voice: voice || "nova",
    input: spoken.slice(0, 4000),
    speed: 1.05,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) {
            resolve(null);
            return;
          }
          resolve(Buffer.concat(chunks).toString("base64"));
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

function sapiSpeak(text) {
  if (process.platform !== "win32") {
    return Promise.resolve({ ok: false, reason: "not-windows" });
  }
  const spoken = forSpeech(text).replace(/'/g, "''");
  if (!spoken) return Promise.resolve({ ok: true });
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 2
try { $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSpecified, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [Globalization.CultureInfo]::GetCultureInfo('es-MX')) } catch {}
$s.Speak('${spoken.slice(0, 1500)}')
`;
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 25000 },
      (err) => resolve({ ok: !err, reason: err ? err.message : "sapi" })
    );
  });
}

module.exports = { cloudTts, sapiSpeak };
