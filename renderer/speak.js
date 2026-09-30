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

function speakBrowser(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const spoken = flatten(text);
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

function playBase64Mp3(b64) {
  return new Promise((resolve) => {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      audio.play().catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

async function speakOut(text) {
  await waitVoices();
  const plan = await window.jarvis.speakPlan(text);
  if (plan.method === "cloud" && plan.audio) {
    const ok = await playBase64Mp3(plan.audio);
    if (ok) return "cloud";
  }
  const es = pickSpanishVoice();
  if (window.__jarvisIsWindows && !es) {
    const sapi = await window.jarvis.sapi(text);
    if (sapi && sapi.ok) return "sapi";
  }
  const local = await speakBrowser(text);
  if (local) return "browser";
  const sapi = await window.jarvis.sapi(text);
  if (sapi && sapi.ok) return "sapi";
  return "none";
}

window.speakOut = speakOut;
window.waitVoices = waitVoices;
