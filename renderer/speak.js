function flatten(text) {
  return String(text || "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSpanishVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  return (
    voices.find((v) => /^es(-|_)MX/i.test(v.lang)) ||
    voices.find((v) => /^es/i.test(v.lang)) ||
    voices.find((v) => /helena|sabina|pablo|spanish|español/i.test(v.name)) ||
    null
  );
}

function waitVoices() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    if (speechSynthesis.getVoices().length) {
      resolve();
      return;
    }
    const done = () => resolve();
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

function monitorElement(audio, onLevel) {
  if (!onLevel || !window.AudioContext) return () => {};
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(audio);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    an.connect(ctx.destination);
    const data = new Uint8Array(an.fftSize);
    let raf = 0;
    const loop = () => {
      an.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

function fakeEnvelope(text, onLevel) {
  if (!onLevel) return () => {};
  const start = Date.now();
  const dur = Math.min(12000, 700 + flatten(text).length * 55);
  let raf = 0;
  const loop = () => {
    const p = Math.min(1, (Date.now() - start) / dur);
    const env = Math.sin(p * Math.PI);
    const wobble = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 70));
    onLevel(env * wobble);
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    cancelAnimationFrame(raf);
    onLevel(0);
  };
}

function speakBrowser(text, onLevel) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve(false);
      return;
    }
    let settled = false;
    const spoken = flatten(text);
    const stopEnv = fakeEnvelope(spoken, onLevel);
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      stopEnv();
      clearTimeout(timer);
      resolve(ok);
    };
    const noVoices = speechSynthesis.getVoices().length === 0;
    const timer = setTimeout(
      () => finish(true),
      noVoices ? 600 : Math.min(12000, 800 + spoken.length * 80)
    );
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "es-MX";
    u.rate = 1.1;
    u.pitch = 1.15;
    u.volume = 1;
    const voice = pickSpanishVoice();
    if (voice) u.voice = voice;
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      finish(false);
    }
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
      const audio = new Audio(url);
      const stopMon = monitorElement(audio, onLevel);
      audio.onended = () => {
        stopMon();
        URL.revokeObjectURL(url);
        if (onLevel) onLevel(0);
        resolve(true);
      };
      audio.onerror = () => {
        stopMon();
        URL.revokeObjectURL(url);
        resolve(false);
      };
      audio.play().catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

async function speakOut(text, onLevel) {
  await waitVoices();
  const plan = await window.jarvis.speakPlan(text);
  if (plan.method === "cloud" && plan.audio) {
    const ok = await playBase64Mp3(plan.audio, onLevel);
    if (ok) return "cloud";
  }
  const es = pickSpanishVoice();
  if (window.__jarvisIsWindows && !es) {
    const stop = fakeEnvelope(text, onLevel);
    const sapi = await window.jarvis.sapi(text);
    stop();
    if (sapi && sapi.ok) return "sapi";
  }
  const local = await speakBrowser(text, onLevel);
  if (local) return "browser";
  const stop = fakeEnvelope(text, onLevel);
  const sapi = await window.jarvis.sapi(text);
  stop();
  if (sapi && sapi.ok) return "sapi";
  return "none";
}

window.speakOut = speakOut;
window.waitVoices = waitVoices;
