function setEar(text) {
  const el = document.getElementById("ear");
  if (el) el.textContent = text;
}

function setLive(text) {
  const el = document.getElementById("live-words");
  if (el) el.textContent = text || "";
  const cap = document.getElementById("caption");
  if (cap && text) cap.textContent = text;
}

function SpeechEngine() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(new Error("read-audio"));
    reader.readAsDataURL(blob);
  });
}

function rmsOf(analyser) {
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    s += v * v;
  }
  return Math.sqrt(s / buf.length);
}

function createListener({ onFinal, onPartial, onError }) {
  let want = false;
  let stream = null;
  let ctx = null;
  let rec = null;
  let flushing = false;
  let loop = 0;

  async function transcribeBlob(blob) {
    if (!blob || blob.size < 1200 || !window.jarvis.transcribe) return "";
    const b64 = await blobToBase64(blob);
    const lang = window.__jarvisSttLang || "es-MX";
    const res = await Promise.race([
      window.jarvis.transcribe(b64, blob.type || "audio/webm", lang),
      new Promise((r) => setTimeout(() => r({ ok: false, reason: "timeout" }), 12000)),
    ]);
    return res && res.ok && res.text ? String(res.text).trim() : "";
  }

  function pickMime() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const t of types) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  async function whisperLoop() {
    if (!stream) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      let chunks = [];
      let recorder = null;
      let speaking = false;
      let quietSince = 0;
      const mime = pickMime();

      function startRec() {
        chunks = [];
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        recorder.start(250);
      }

      async function flush() {
        if (flushing || !recorder) return;
        flushing = true;
        const r = recorder;
        recorder = null;
        speaking = false;
        try {
          await new Promise((resolve) => {
            r.onstop = resolve;
            try {
              r.stop();
            } catch {
              resolve();
            }
            setTimeout(resolve, 800);
          });
          const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
          chunks = [];
          if (blob.size > 1500) {
            setLive("transcribiendo…");
            const text = await transcribeBlob(blob);
            if (text) {
              setLive("te oí: " + text);
              if (onPartial) onPartial(text, true);
              onFinal(text);
            } else {
              setLive("");
            }
          }
        } catch (err) {
          onError((err && err.message) || "whisper");
        } finally {
          flushing = false;
        }
      }

      const tick = async () => {
        if (!want) return;
        if (window.__jarvisMuteEar) {
          loop = setTimeout(tick, 80);
          return;
        }
        const amp = rmsOf(an);
        if (onPartial && speaking) onPartial("…", false);
        if (amp > 0.045) {
          quietSince = 0;
          if (!speaking && !flushing) {
            speaking = true;
            setLive("te oigo…");
            startRec();
          }
        } else if (speaking) {
          quietSince += 80;
          if (quietSince > 900) await flush();
        }
        loop = setTimeout(tick, 80);
      };
      tick();
    } catch (err) {
      onError((err && err.message) || "mic-loop");
    }
  }

  async function windowsLoop() {
    while (want && window.jarvis.windowsListen) {
      setLive("te oigo…");
      const res = await Promise.race([
        window.jarvis.windowsListen(8),
        new Promise((r) => setTimeout(() => r({ ok: false, reason: "timeout" }), 12000)),
      ]);
      if (!want) return;
      if (res && res.ok && res.text) {
        setLive("te oí: " + res.text);
        onFinal(String(res.text).trim());
      }
    }
  }

  function startWebkit() {
    const Engine = SpeechEngine();
    if (!Engine) return false;
    rec = new Engine();
    rec.lang = /es/i.test(window.__jarvisSttLang || "") ? "es-MX" : window.__jarvisSttLang || "es-MX";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0] && event.results[i][0].transcript;
        if (!piece) continue;
        if (event.results[i].isFinal) final += piece;
        else interim += piece;
      }
      const live = (final || interim).trim();
      if (live) {
        setLive(final ? "te oí: " + live : live);
        if (onPartial) onPartial(live, Boolean(final));
      }
      if (final.trim()) onFinal(final.trim());
    };
    rec.onerror = (e) => {
      const err = e && e.error;
      if (err !== "no-speech" && err !== "aborted") onError(err || "stt");
    };
    rec.onend = () => {
      if (want) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    try {
      rec.start();
      return true;
    } catch {
      return false;
    }
  }

  async function startAlways() {
    want = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      onError((err && err.name) || err.message || "mic");
      return;
    }
    const st = (await window.jarvis.status().catch(() => ({}))) || {};
    if (st.hasLlm && window.MediaRecorder) {
      setEar("OÍDO ON · whisper");
      whisperLoop();
      return;
    }
    if (st.isWindows && window.jarvis.windowsListen) {
      setEar("OÍDO ON · windows");
      windowsLoop();
      return;
    }
    if (startWebkit()) {
      setEar("OÍDO ON · chrome");
      return;
    }
    setEar("OÍDO: SIN STT");
    onError("sin-stt");
  }

  function stop() {
    want = false;
    clearTimeout(loop);
    try {
      rec && rec.stop();
    } catch {
      /* ignore */
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    setEar("OÍDO: OFF");
    setLive("");
  }

  function startPtt() {
    startAlways();
  }

  function endPtt() {
    stop();
  }

  return { supported: true, startAlways, stop, startPtt, endPtt };
}

window.createListener = createListener;
window.speechSupported = () => true;
