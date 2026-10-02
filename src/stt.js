const https = require("https");
const { URL } = require("url");
const { execFile } = require("child_process");

function whisperConfidence(json) {
  const segs = json && Array.isArray(json.segments) ? json.segments : [];
  let logsum = 0;
  let n = 0;
  for (const s of segs) {
    if (s && typeof s.avg_logprob === "number") {
      logsum += s.avg_logprob;
      n += 1;
    }
  }
  return n ? logsum / n : null;
}

function whisperLow(json) {
  const segs = json && Array.isArray(json.segments) ? json.segments : [];
  if (!segs.length) return false;
  let noSpeech = 0;
  for (const s of segs) {
    if (s && typeof s.no_speech_prob === "number") noSpeech = Math.max(noSpeech, s.no_speech_prob);
  }
  const avg = whisperConfidence(json);
  if (noSpeech >= 0.6) return true;
  if (avg != null && avg <= -1.05) return true;
  return false;
}

function whisperTranscribe({ apiKey, baseUrl, audio, mime, filename, language }) {
  if (!apiKey || !audio || !audio.length) {
    return Promise.resolve({ ok: false, reason: "no-audio" });
  }
  const root = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = new URL(`${root}/audio/transcriptions`);
  const buf = Buffer.isBuffer(audio) ? audio : Buffer.from(audio, "base64");
  const name = filename || "speech.webm";
  const type = mime || "audio/webm";
  const boundary = "----jarvisStt" + Date.now().toString(16);
  const lang = language && /^es/i.test(language) ? "es" : language || "es";
  const head =
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${lang}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(head, "utf8"), buf, Buffer.from(tail, "utf8")]);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (!res.statusCode || res.statusCode >= 400) {
            resolve({ ok: false, reason: `whisper HTTP ${res.statusCode}` });
            return;
          }
          try {
            const json = JSON.parse(raw);
            const text = String(json.text || "").trim();
            const low = whisperLow(json);
            resolve({
              ok: Boolean(text),
              text,
              low,
              confidence: whisperConfidence(json),
              reason: text ? "whisper" : "empty",
            });
          } catch {
            resolve({ ok: false, reason: "whisper-parse" });
          }
        });
      }
    );
    req.on("error", (err) => resolve({ ok: false, reason: err.message }));
    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ ok: false, reason: "whisper-timeout" });
    });
    req.write(body);
    req.end();
  });
}

function windowsDictation(seconds = 8) {
  if (process.platform !== "win32") {
    return Promise.resolve({ ok: false, reason: "not-windows" });
  }
  const wait = Math.max(3, Math.min(20, Number(seconds) || 8));
  const script = `
Add-Type -AssemblyName System.Speech
$eng = New-Object System.Speech.Recognition.SpeechRecognitionEngine
foreach ($c in @('es-MX','es-ES','en-US')) {
  try { $eng.SetInputToDefaultAudioDevice(); break } catch {}
}
try { $eng.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar)) } catch {}
foreach ($c in @('es-MX','es-ES')) {
  try { $eng = New-Object System.Speech.Recognition.SpeechRecognitionEngine ([Globalization.CultureInfo]::GetCultureInfo($c)); $eng.SetInputToDefaultAudioDevice(); $eng.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar)); break } catch {}
}
$r = $eng.Recognize([TimeSpan]::FromSeconds(${wait}))
if ($r -and $r.Text) { $r.Text } else { '' }
`;
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: (wait + 8) * 1000 },
      (err, stdout) => {
        if (err) {
          resolve({ ok: false, reason: err.message });
          return;
        }
        const text = String(stdout || "").trim();
        resolve({ ok: Boolean(text), text, reason: text ? "windows" : "empty" });
      }
    );
  });
}

module.exports = { whisperTranscribe, windowsDictation, whisperLow, whisperConfidence };
