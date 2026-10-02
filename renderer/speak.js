function flatten(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

const SKIP = /helena|sabina|elvira|monica|laura|pilar|paulina|zira|hazel|susan|nova|shimmer/i;
const PREFER = /ollie|george|ryan|daniel|alvaro|jorge|pablo|diego|united kingdom|en-gb/i;
const SILENT =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let audioCtx = null;
let unlocked = false;

function voiceEl() {
  let el = document.getElementById("jarvis-voice");
  if (!el) {
    el = document.createElement("audio");
    el.id = "jarvis-voice";
    el.setAttribute("playsinline", "");
    document.body.appendChild(el);
  }
  el.muted = false;
  el.volume = 1;
  return el;
}

function ensureCtx() {
  if (!window.AudioContext) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

async function unlockAudio() {
  unlocked = true;
  const ctx = ensureCtx();
  if (ctx && ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  const el = voiceEl();
  try {
    el.muted = false;
    el.volume = 1;
    el.src = SILENT;
    await el.play();
    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch {
    /* first gesture may still be required */
  }
  return { unlocked: true, ctx: ctx ? ctx.state : "none" };
}

function pickJarvisVoice(preferredName) {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (preferredName) {
    const hit = voices.find(
      (v) => v.name === preferredName || (v.name && v.name.toLowerCase().includes(String(preferredName).toLowerCase()))
    );
    if (hit) return hit;
  }
  let best = null;
  let bestScore = -1;
  for (const v of voices) {
    if (SKIP.test(v.name || "")) continue;
    const blob = `${v.name || ""} ${v.lang || ""}`;
    let score = 0;
    if (/^en(-|_)GB/i.test(v.lang)) score += 6;
    if (/^es(-|_)ES/i.test(v.lang)) score += 5;
    if (/^es/i.test(v.lang)) score += 3;
    if (PREFER.test(blob)) score += 10;
    if (/male/i.test(v.name)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best || voices.find((v) => /^es/i.test(v.lang)) || voices[0] || null;
}

function waitVoices() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve([]);
      return;
    }
    const grab = () => speechSynthesis.getVoices() || [];
    if (grab().length) {
      resolve(grab());
      return;
    }
    const done = () => resolve(grab());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    speechSynthesis.getVoices();
    setTimeout(done, 2500);
  });
}

function monitorElement(audio, onLevel) {
  const ctx = ensureCtx();
  if (!onLevel || !ctx || ctx.state !== "running") return () => {};
  try {
    const src = ctx.createMediaElementSource(audio);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    an.connect(ctx.destination);
    const time = new Uint8Array(an.fftSize);
    const spec = new Uint8Array(an.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      an.getByteTimeDomainData(time);
      an.getByteFrequencyData(spec);
      let sum = 0;
      for (let i = 0; i < time.length; i++) {
        const v = (time[i] - 128) / 128;
        sum += v * v;
      }
      const amp = Math.min(1, Math.sqrt(sum / time.length) * 4);
      let mag = 0;
      let wsum = 0;
      for (let i = 1; i < spec.length; i++) {
        mag += spec[i];
        wsum += spec[i] * i;
      }
      const freq = mag > 8 ? Math.min(1, wsum / mag / (spec.length * 0.45)) : 0.35;
      onLevel(amp, freq);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  } catch {
    return () => {};
  }
}

function fakeEnvelope(text, onLevel) {
  if (!onLevel) return () => {};
  const start = Date.now();
  const spoken = flatten(text);
  const dur = Math.min(12000, 700 + spoken.length * 55);
  let raf = 0;
  const loop = () => {
    const p = Math.min(1, (Date.now() - start) / dur);
    const env = Math.sin(p * Math.PI);
    const now = Date.now();
    const syllable = 0.35 + 0.65 * Math.abs(Math.sin(now / 85));
    const amp = env * syllable;
    const freq = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(now / (90 + 40 * Math.sin(now / 310))));
    onLevel(amp, freq);
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    cancelAnimationFrame(raf);
    onLevel(0, 0);
  };
}

function speakBrowser(text, onLevel, plan) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve({ ok: false, error: "sin speechSynthesis" });
      return;
    }
    const voices = speechSynthesis.getVoices() || [];
    if (!voices.length) {
      resolve({ ok: false, error: "voces Chromium vacías (espera un clic o instala voces)" });
      return;
    }
    let settled = false;
    const spoken = flatten(text);
    const stopEnv = fakeEnvelope(spoken, onLevel);
    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      stopEnv();
      clearTimeout(timer);
      clearTimeout(watch);
      resolve({ ok, method: ok ? "browser" : "none", error: ok ? "" : error || "speechSynthesis falló" });
    };
    const timer = setTimeout(
      () => finish(speechSynthesis.speaking || speechSynthesis.pending, "timeout speechSynthesis"),
      Math.min(12000, 900 + spoken.length * 80)
    );
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = (plan && plan.lang) || "es-ES";
    u.rate = 0.96;
    u.pitch = 0.9;
    u.volume = 1;
    const voice = pickJarvisVoice(plan && plan.voice);
    if (voice) {
      u.voice = voice;
      if (voice.lang) u.lang = voice.lang;
    }
    u.onend = () => finish(true);
    u.onerror = (e) => finish(false, (e && e.error) || "utterance error");
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (err) {
      finish(false, err.message || "speak() lanzó");
    }
    const watch = setTimeout(() => {
      if (!settled && !speechSynthesis.speaking && !speechSynthesis.pending) {
        finish(false, "speechSynthesis no arrancó (gesto o voces)");
      }
    }, 450);
  });
}

function playBase64Mp3(b64, onLevel) {
  return new Promise((resolve) => {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = voiceEl();
      audio.muted = false;
      audio.volume = 1;
      audio.src = url;
      const ctx = ensureCtx();
      const graphOk = ctx && ctx.state === "running";
      const stopMon = graphOk ? monitorElement(audio, onLevel) : fakeEnvelope("mp3", onLevel);
      const done = (ok, error) => {
        stopMon();
        URL.revokeObjectURL(url);
        if (onLevel) onLevel(0, 0);
        resolve({ ok, error: ok ? "" : error || "audio.play falló" });
      };
      audio.onended = () => done(true);
      audio.onerror = () => done(false, "elemento <audio> error");
      const playp = audio.play();
      if (playp && playp.then) {
        playp.catch((err) => done(false, err && err.name === "NotAllowedError" ? "autoplay bloqueado — pulsa Oído o la ventana" : (err && err.message) || "play rechazado"));
      }
    } catch (err) {
      resolve({ ok: false, error: err.message || "mp3 inválido" });
    }
  });
}

async function speakOut(text, onLevel, opts) {
  await unlockAudio();
  await waitVoices();
  const plan =
    (await window.jarvis.speakPlan({
      text,
      code: Boolean(opts && opts.code),
      search: Boolean(opts && opts.search),
    })) || {};
  const spoken = (plan && plan.spoken) || text;
  if ((plan.method === "cloud" || plan.method === "edge") && plan.audio) {
    const played = await playBase64Mp3(plan.audio, onLevel);
    if (played.ok) return { ok: true, method: plan.method, spoken };
  }
  if (plan.method === "browser") {
    const local = await speakBrowser(spoken, onLevel, plan);
    if (local.ok) return { ...local, spoken };
  }
  if (window.__jarvisIsWindows || plan.method === "local") {
    const stop = fakeEnvelope(spoken, onLevel);
    const sapi = await window.jarvis.sapi(spoken, plan.sapiVoice || "", {
      code: Boolean(opts && opts.code),
      search: Boolean(opts && opts.search),
    });
    stop();
    if (sapi && sapi.ok) return { ok: true, method: "sapi", spoken };
    if (sapi && sapi.reason && sapi.reason !== "not-windows") {
      const local = await speakBrowser(spoken, onLevel, plan);
      if (local.ok) return { ...local, spoken };
      return { ok: false, method: "none", error: "SAPI: " + sapi.reason, spoken };
    }
  }
  const local = await speakBrowser(spoken, onLevel, plan);
  if (local.ok) return { ...local, spoken };
  return {
    ok: false,
    method: "none",
    spoken,
    error: local.error || "ni Edge, ni OpenAI, ni SAPI, ni Chromium",
  };
}

window.speakOut = speakOut;
window.waitVoices = waitVoices;
window.unlockAudio = unlockAudio;
window.pickJarvisVoice = pickJarvisVoice;
