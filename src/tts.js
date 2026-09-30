const https = require("https");
const { URL } = require("url");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { forSpeech } = require("./spoken");
const { JARVIS_TTS } = require("./jarvis-voice");

function cloudTts({ apiKey, baseUrl, text, voice, model, speed }) {
  if (!apiKey) return Promise.resolve(null);
  const spoken = forSpeech(text);
  if (!spoken) return Promise.resolve(null);
  const root = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = new URL(`${root}/audio/speech`);
  const body = JSON.stringify({
    model: model || JARVIS_TTS.openaiModel,
    voice: voice || JARVIS_TTS.openaiVoice,
    input: spoken.slice(0, 4000),
    speed: speed || JARVIS_TTS.openaiSpeed,
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

async function edgeTts(text, preferred) {
  const spoken = forSpeech(text);
  if (!spoken) return null;
  const voices = [];
  if (preferred) voices.push(preferred);
  for (const v of JARVIS_TTS.edgeVoices) {
    if (!voices.includes(v)) voices.push(v);
  }
  for (const voice of voices) {
    const audio = await tryEdgeVoice(spoken.slice(0, 4000), voice);
    if (audio) return { audio, voice };
  }
  return null;
}

function langFromEdgeId(id) {
  const m = String(id || "").match(/^([a-z]{2}-[A-Z]{2})/);
  return m ? m[1] : "en-US";
}

async function tryEdgeVoice(spoken, voice) {
  const { EdgeTTS } = require("node-edge-tts");
  const out = path.join(
    os.tmpdir(),
    `jarvis-tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
  );
  try {
    const tts = new EdgeTTS({
      voice,
      lang: langFromEdgeId(voice),
      rate: JARVIS_TTS.edgeRate,
      pitch: JARVIS_TTS.edgePitch,
      timeout: 14000,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    });
    await tts.ttsPromise(spoken, out);
    if (!fs.existsSync(out) || fs.statSync(out).size < 200) return null;
    return fs.readFileSync(out).toString("base64");
  } catch {
    return null;
  } finally {
    try {
      fs.unlinkSync(out);
    } catch {
      /* ignore */
    }
  }
}

function sapiSpeak(text, voiceName) {
  if (process.platform !== "win32") {
    return Promise.resolve({ ok: false, reason: "not-windows" });
  }
  const spoken = forSpeech(text).replace(/'/g, "''");
  if (!spoken) return Promise.resolve({ ok: true });
  const want = String(voiceName || "").replace(/'/g, "''");
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = -1
$s.Volume = 100
$picked = $false
$all = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo }
$want = '${want}'
if ($want) {
  $v = $all | Where-Object { $_.Name -eq $want -or $_.Name -match $want } | Select-Object -First 1
  if ($v) { try { $s.SelectVoice($v.Name); $picked = $true } catch {} }
}
if (-not $picked) {
  $prefer = @('George','Ryan','Ollie','Daniel','Alvaro','Jorge','Pablo','Diego')
  foreach ($p in $prefer) {
    $v = $all | Where-Object { $_.Name -match $p } | Select-Object -First 1
    if ($v) { try { $s.SelectVoice($v.Name); $picked = $true; break } catch {} }
  }
}
if (-not $picked) {
  try { $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [Globalization.CultureInfo]::GetCultureInfo('en-GB')) } catch {}
}
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

function listSapiVoices() {
  if (process.platform !== "win32") return Promise.resolve([]);
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.GetInstalledVoices() | ForEach-Object {
  $i = $_.VoiceInfo
  [pscustomobject]@{ name = $i.Name; lang = $i.Culture.Name; gender = $i.Gender.ToString() }
} | ConvertTo-Json -Compress
`;
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(String(stdout));
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          resolve(
            arr
              .filter((v) => v && v.name)
              .map((v) => ({
                engine: "sapi",
                id: v.name,
                label: v.name,
                lang: v.lang || "",
                gender: String(v.gender || "").toLowerCase(),
              }))
          );
        } catch {
          resolve([]);
        }
      }
    );
  });
}

module.exports = { cloudTts, edgeTts, sapiSpeak, listSapiVoices };
