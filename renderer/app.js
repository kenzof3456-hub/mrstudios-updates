const logEl = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const attachBtn = document.getElementById("attach");
const attachPreview = document.getElementById("attach-preview");
const attachThumb = document.getElementById("attach-thumb");
const attachLabel = document.getElementById("attach-label");
const attachClear = document.getElementById("attach-clear");
const pill = document.getElementById("status-pill");
const ear = document.getElementById("ear");
const alwaysBtn = document.getElementById("mic-always");
const pttBtn = document.getElementById("mic-ptt");
const caption = document.getElementById("caption");
const voicePick = document.getElementById("voice-pick");
const micHint = document.getElementById("mic-hint");
const micHintTitle = document.getElementById("mic-hint-title");
const micHintBody = document.getElementById("mic-hint-body");
const micHintRetry = document.getElementById("mic-hint-retry");
const micPick = document.getElementById("mic-pick");
const gearBtn = document.getElementById("gear");
const keyPanel = document.getElementById("key-panel");
const apiKeyInput = document.getElementById("api-key");
const apiKeySave = document.getElementById("api-key-save");
const apiKeyState = document.getElementById("api-key-state");

const history = [];
let speaking = false;
let awaitCommand = false;
let voiceMode = "off";
let listener = null;
let pendingAttach = null;
let onlineLabel = "EN LÍNEA";
let retrySpeak = "";
let earWanted = true;
let earBusy = false;
let skipEarToggle = 0;
let turnBusy = false;
let needWake = true;
let unmuteTimer = 0;
const EAR_RESUME_MS = 400;
const sendQueue = [];

function showAttach(info) {
  pendingAttach = info;
  attachPreview.hidden = false;
  attachLabel.textContent =
    info.kind === "image" ? "Foto lista: " + info.name : "Archivo: " + info.name;
  if (info.preview) {
    attachThumb.src = info.preview;
    attachThumb.classList.add("show");
  } else {
    attachThumb.removeAttribute("src");
    attachThumb.classList.remove("show");
  }
  input.placeholder = "«mira esto» o pregunta sobre el archivo…";
}

function hideAttach() {
  pendingAttach = null;
  attachPreview.hidden = true;
  attachThumb.removeAttribute("src");
  attachThumb.classList.remove("show");
  input.placeholder = "«Jarvis» o escribe…";
}

function mode() {
  if (speaking) return "speak";
  if (awaitCommand || voiceMode === "ptt" || voiceMode === "always") return "listen";
  return "idle";
}

function showMicHint(title, body) {
  if (!micHint) return;
  if (micHintTitle) micHintTitle.textContent = title;
  if (micHintBody) micHintBody.textContent = body;
  micHint.hidden = false;
}

function hideMicHint() {
  if (micHint) micHint.hidden = true;
}

function applyOrb() {
  if (window.orbSetState) window.orbSetState(mode());
  if (mode() !== "speak" && window.orbSetLevel) window.orbSetLevel(0);
}

function addMsg(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "jarvis" ? "JARVIS" : "SEÑOR";
  el.appendChild(who);
  el.appendChild(document.createTextNode(text));
  logEl.appendChild(el);
  while (logEl.children.length > 8) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
  if (role === "jarvis" && caption) caption.textContent = text.split("\n")[0];
}

function setTalking(on) {
  speaking = on;
  if (pill) {
    pill.textContent = on ? "HABLANDO" : onlineLabel;
    pill.classList.toggle("hablando", on);
  }
  applyOrb();
}

function setThinking(on) {
  if (!pill) return;
  if (on) {
    pill.textContent = "PENSANDO…";
    pill.classList.add("hablando");
  } else if (!speaking) {
    pill.textContent = onlineLabel;
    pill.classList.remove("hablando");
  }
}

function muteEar() {
  window.__jarvisMuteEar = true;
  clearTimeout(unmuteTimer);
}

function scheduleUnmute() {
  clearTimeout(unmuteTimer);
  unmuteTimer = setTimeout(() => {
    window.__jarvisMuteEar = false;
  }, EAR_RESUME_MS);
}

async function talk(text, opts) {
  const line = String(text || "").trim();
  if (!line) return;
  muteEar();
  window.__jarvisLastSpoken = line;
  if (window.unlockAudio) await window.unlockAudio();
  setTalking(true);
  try {
    const result = await Promise.race([
      window.speakOut(line, (amp, freq) => window.orbSetLevel && window.orbSetLevel(amp, freq), opts),
      new Promise((r) => setTimeout(() => r({ ok: false, error: "tts-timeout" }), 12000)),
    ]);
    if (result && result.spoken) window.__jarvisLastSpoken = result.spoken;
    const ok = result && (result.ok === true || typeof result === "string" && result !== "none");
    if (!ok) {
      const reason = (result && result.error) || "sin motor de voz";
      retrySpeak = line;
      addMsg("jarvis", "no pude hablar: " + reason);
    } else {
      retrySpeak = "";
    }
  } finally {
    setTalking(false);
    if (!(opts && opts.keepArmed)) {
      needWake = true;
      awaitCommand = false;
    }
    scheduleUnmute();
    applyOrb();
  }
}

async function onUserUnlock(ev) {
  const t = ev && ev.target;
  if (t && (t.id === "input" || t.id === "send" || (t.closest && t.closest("#form")))) {
    return;
  }
  if (window.unlockAudio) window.unlockAudio().catch(() => {});
  if (earWanted) enableEar().catch(() => {});
  if (retrySpeak && !speaking && !turnBusy) {
    const line = retrySpeak;
    retrySpeak = "";
    talk(line).catch(() => {});
  }
}

function enqueueSend(text) {
  const trimmed = (text || "").trim();
  const withFile = Boolean(pendingAttach);
  if (!trimmed && !withFile) return;
  const spoken = trimmed || "mira esto";
  const useAttach = withFile;
  const attachName = withFile && pendingAttach ? pendingAttach.name : "";
  if (useAttach) hideAttach();
  if (input) {
    input.value = "";
    input.disabled = false;
  }
  if (sendBtn) sendBtn.disabled = false;
  sendQueue.push({ spoken, useAttach, attachName });
  pumpTurns();
}

async function pumpTurns() {
  if (turnBusy) return;
  turnBusy = true;
  setThinking(true);
  try {
    while (sendQueue.length) {
      const job = sendQueue.shift();
      await runTurn(job);
    }
  } finally {
    turnBusy = false;
    setThinking(false);
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function runTurn(job) {
  const spoken = job.spoken;
  addMsg("user", job.useAttach && job.attachName ? spoken + "  ·  " + job.attachName : spoken);
  history.push({ role: "user", content: spoken });
  const hung = { reply: "Tardé de más, Señor. Prueba otra vez o escribe." };
  let res = hung;
  try {
    res =
      (await Promise.race([
        window.jarvis.chat(spoken, history.slice(0, -1), { useAttach: job.useAttach }),
        new Promise((r) => setTimeout(() => r(hung), 14000)),
      ])) || hung;
  } catch (err) {
    res = { reply: "Fallo de enlace, Señor: " + ((err && err.message) || "error") };
  }
  const reply = (res && res.reply) || hung.reply;
  addMsg("jarvis", reply);
  history.push({ role: "assistant", content: reply });
  const toSay = (res && res.speak) || reply;
  if (res && res.language) {
    const stt = { es: "es-MX", en: "en-GB", pt: "pt-BR", fr: "fr-FR", de: "de-DE", it: "it-IT", ja: "ja-JP", zh: "zh-CN", ko: "ko-KR" };
    window.__jarvisSttLang = stt[res.language] || "es-MX";
  }
  if (res && res.voice) fillVoices().catch(() => {});
  await talk(toSay, {
    code: Boolean(res && (res.intent === "craft" || res.intent === "save_code")),
    search: Boolean(res && (res.searched || res.intent === "tv")),
  });
}

async function sayRepeat() {
  const line = "¿puedes repetir?";
  addMsg("jarvis", line);
  history.push({ role: "assistant", content: line });
  await talk(line);
}

async function onHeard(finalText, meta) {
  if (speaking || window.__jarvisMuteEar) return;
  const heard = String(finalText || "").trim();
  if (!heard) return;
  const low = Boolean(meta && meta.low);
  let echo = false;
  let junk = false;
  let hearing = false;
  try {
    const gate = await window.jarvis.earCheck({
      text: heard,
      last: window.__jarvisLastSpoken || "",
    });
    echo = Boolean(gate && gate.echo);
    junk = Boolean(gate && gate.junk);
    hearing = Boolean(gate && gate.hearing);
  } catch {
    echo = false;
  }
  if (echo) return;
  const parsed = await window.jarvis.parseWake(heard);
  const taking = voiceMode === "ptt" || awaitCommand || !needWake;
  let restJunk = false;
  if (parsed.woke && parsed.rest) {
    try {
      const restGate = await window.jarvis.earCheck({ text: parsed.rest, last: "" });
      restJunk = Boolean(restGate && restGate.junk);
      if (restGate && restGate.hearing) hearing = true;
    } catch {
      restJunk = false;
    }
  }
  if (hearing && !low) {
    needWake = false;
    awaitCommand = false;
    enqueueSend(parsed.woke && parsed.rest ? parsed.rest : heard);
    return;
  }
  if (low || junk || restJunk) {
    if (parsed.woke || taking) await sayRepeat();
    return;
  }
  if (parsed.woke) {
    const line = await window.jarvis.wakeLine();
    addMsg("jarvis", line);
    history.push({ role: "assistant", content: line });
    if (parsed.rest) {
      await talk(line, { keepArmed: true });
      needWake = false;
      awaitCommand = false;
      applyOrb();
      enqueueSend(parsed.rest);
    } else {
      await talk(line, { keepArmed: true });
      awaitCommand = true;
      needWake = false;
      if (ear) ear.textContent = "ESCUCHANDO";
      applyOrb();
    }
    return;
  }
  if (taking) {
    awaitCommand = false;
    needWake = false;
    applyOrb();
    enqueueSend(heard);
  }
}

window.__jarvisHeard = onHeard;

function onListenError(err) {
  const why = String(err || "stt");
  if (ear) ear.textContent = "MIC " + why;
  if (why === "not-allowed" || why === "service-not-allowed") {
    showMicHint(
      "Windows bloqueó el micrófono",
      "Configuración → Privacidad y seguridad → Micrófono → permitir apps de escritorio. Luego Reintentar."
    );
  } else if (why !== "no-speech") {
    showMicHint(
      "Jarvis no está oyendo",
      "Fallo del oído: " + why + ". Pulsa Reintentar. Mientras tanto, escribe."
    );
  }
}

async function armMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMicHint(
      "Este PC no da micrófono",
      "No hay getUserMedia. Escribe abajo; el teclado sigue."
    );
    addMsg("jarvis", "no pude oír: este motor no pide micrófono. Escribe, Señor.");
    return false;
  }
  try {
    const audio = window.jarvisAudioConstraint ? window.jarvisAudioConstraint() : true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (err) {
      if (!window.__jarvisMicId) throw err;
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    stream.getTracks().forEach((t) => t.stop());
    hideMicHint();
    fillMics().catch(() => {});
    return true;
  } catch (err) {
    const name = (err && err.name) || "";
    const msg = (err && err.message) || String(err);
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || /denied|notallowed/i.test(msg)) {
      showMicHint(
        "Windows bloqueó el micrófono",
        "Configuración → Privacidad y seguridad → Micrófono → Permitir que las aplicaciones de escritorio accedan al micrófono. Acepta el aviso de Jarvis y pulsa Reintentar."
      );
      addMsg("jarvis", "no pude oír: permiso denegado. " + msg);
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      showMicHint(
        "No hay micrófono en este PC",
        "En esta máquina no hay micro (o no está enchufado). Escribe abajo; el chat sigue."
      );
      addMsg("jarvis", "no pude oír: no hay micrófono. Escribe, Señor.");
    } else {
      showMicHint("Jarvis no está oyendo", "No pude abrir el micrófono: " + msg + ". Escribe abajo o Reintentar.");
      addMsg("jarvis", "no pude oír: " + msg);
    }
    return false;
  }
}

async function enableEar() {
  if (voiceMode === "always" && listener) return true;
  if (earBusy) return voiceMode === "always";
  earBusy = true;
  skipEarToggle = Date.now() + 500;
  try {
    if (!listener) {
      listener = window.createListener({
        onFinal: onHeard,
        onPartial: (t, done) => {
          const el = document.getElementById("live-words");
          if (el) el.textContent = done && t ? "te oí: " + t : t || el.textContent;
        },
        onError: onListenError,
      });
    }
    if (!(await armMic())) {
      alwaysBtn.classList.remove("on");
      voiceMode = "off";
      applyOrb();
      return false;
    }
    voiceMode = "always";
    alwaysBtn.classList.add("on");
    alwaysBtn.disabled = false;
    listener.startAlways();
    skipEarToggle = Date.now() + 500;
    applyOrb();
    return true;
  } finally {
    earBusy = false;
  }
}

async function fillMics() {
  if (!micPick || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
  const current = window.__jarvisMicId || "";
  micPick.dataset.filling = "1";
  try {
    micPick.innerHTML = "";
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "Predeterminado";
    micPick.appendChild(def);
    inputs.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = d.deviceId;
      o.textContent = d.label || "Micrófono " + (i + 1);
      micPick.appendChild(o);
    });
    const has = [...micPick.options].some((o) => o.value === current);
    micPick.value = has ? current : "";
    if (!has) window.__jarvisMicId = "";
  } finally {
    delete micPick.dataset.filling;
  }
}

async function useMic(deviceId) {
  window.__jarvisMicId = deviceId || "";
  if (window.jarvis.setMic) {
    try {
      await window.jarvis.setMic(window.__jarvisMicId);
    } catch {
      /* keep the choice in this window */
    }
  }
  if (voiceMode === "always") {
    if (listener) listener.stop();
    listener = null;
    voiceMode = "off";
    await enableEar();
  }
}

async function fillVoices() {
  if (!voicePick || !window.jarvis.voices) return;
  voicePick.dataset.filling = "1";
  try {
    if (window.waitVoices) await window.waitVoices();
    const syn = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (window.jarvis.reportBrowserVoices) {
      await window.jarvis.reportBrowserVoices(syn.map((v) => ({ name: v.name, lang: v.lang })));
    }
    const data = await window.jarvis.voices();
    const groups = {};
    for (const v of data.list || []) {
      const g = v.engine || "otro";
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    }
    voicePick.innerHTML = "";
    for (const eng of Object.keys(groups)) {
      const og = document.createElement("optgroup");
      og.label = eng;
      for (const v of groups[eng]) {
        const o = document.createElement("option");
        o.value = (v.engine || "") + "::" + v.id;
        o.textContent = v.label + (v.lang ? " · " + v.lang : "");
        o.dataset.engine = v.engine || "";
        o.dataset.id = v.id;
        o.dataset.label = v.label || v.id;
        o.dataset.lang = v.lang || "";
        o.dataset.gender = v.gender || "";
        og.appendChild(o);
      }
      voicePick.appendChild(og);
    }
    if (data.current && data.current.id) {
      voicePick.value = (data.current.engine || "") + "::" + data.current.id;
    }
  } finally {
    delete voicePick.dataset.filling;
  }
}

async function boot() {
  applyOrb();
  try {
    const s = await window.jarvis.status();
    onlineLabel = s.isWindows ? "EN LÍNEA" : "DEV";
    if (pill) pill.textContent = onlineLabel;
    window.__jarvisIsWindows = Boolean(s.isWindows);
    window.__jarvisSttLang = (s.profile && s.profile.locale) || "es-MX";
    window.__jarvisMicId = (s.profile && s.profile.micDeviceId) || "";
    if (apiKeyState) apiKeyState.textContent = s.hasLlm ? "Clave guardada en este PC." : "Sin clave. Puedes pegarla aquí.";
    if (window.waitVoices) await window.waitVoices();
    await fillVoices();
    await fillMics();
    addMsg("jarvis", s.greeting);
    retrySpeak = s.greeting;
    talk(s.greeting).catch(() => {});
  } catch (err) {
    addMsg("jarvis", "No pude iniciar el núcleo: " + err.message);
  }

  listener = window.createListener({
    onFinal: onHeard,
    onPartial: (t, done) => {
      const el = document.getElementById("live-words");
      if (el) el.textContent = done && t ? "te oí: " + t : t || "";
    },
    onError: onListenError,
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  enqueueSend(input.value);
});

attachBtn.addEventListener("click", async () => {
  try {
    const picked = await window.jarvis.pickFile();
    if (!picked || picked.cancelled) return;
    if (!picked.ok) {
      addMsg("jarvis", picked.error || "No pude adjuntar eso, Señor.");
      return;
    }
    showAttach(picked);
    addMsg("jarvis", "Adjunto listo: «" + picked.name + "». Envía vacío o di «mira esto».");
  } catch (err) {
    addMsg("jarvis", "No pude abrir el archivo: " + err.message);
  }
});

attachClear.addEventListener("click", () => hideAttach());

if (micPick) {
  micPick.addEventListener("change", async () => {
    if (micPick.dataset.filling) return;
    await useMic(micPick.value || "");
    await fillMics();
  });
}

if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    fillMics().catch(() => {});
  });
}

if (gearBtn && keyPanel) {
  gearBtn.addEventListener("click", () => {
    keyPanel.hidden = !keyPanel.hidden;
    if (!keyPanel.hidden && apiKeyInput) apiKeyInput.focus();
  });
}

if (apiKeyInput && apiKeySave) {
  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apiKeySave.click();
    }
  });
}

if (apiKeySave) {
  apiKeySave.addEventListener("click", async () => {
    const key = apiKeyInput ? apiKeyInput.value.trim() : "";
    try {
      const saved = await window.jarvis.setApiKey(key);
      if (apiKeyInput) apiKeyInput.value = "";
      if (apiKeyState) {
        apiKeyState.textContent =
          saved && saved.hasLlm ? "Clave guardada en este PC." : "Sin clave. Jarvis sigue en local.";
      }
    } catch (err) {
      if (apiKeyState) apiKeyState.textContent = "No pude guardar la clave.";
    }
  });
}

if (voicePick) {
  voicePick.addEventListener("change", async () => {
    if (voicePick.dataset.filling) return;
    const o = voicePick.selectedOptions[0];
    if (!o || !o.dataset.id) return;
    await window.jarvis.setVoice({
      engine: o.dataset.engine,
      id: o.dataset.id,
      label: o.dataset.label,
      lang: o.dataset.lang,
      gender: o.dataset.gender,
    });
    await talk("Así sueno ahora, Señor. " + o.dataset.label + ".");
  });
}

for (const btn of document.querySelectorAll(".chips button[data-q]")) {
  btn.addEventListener("click", () => enqueueSend(btn.dataset.q));
}

alwaysBtn.addEventListener("click", async () => {
  if (Date.now() < skipEarToggle) return;
  if (voiceMode === "always") {
    earWanted = false;
    voiceMode = "off";
    listener && listener.stop();
    alwaysBtn.classList.remove("on");
    applyOrb();
    return;
  }
  earWanted = true;
  await enableEar();
});

if (micHintRetry) {
  micHintRetry.addEventListener("click", async () => {
    earWanted = true;
    hideMicHint();
    await enableEar();
  });
}

pttBtn.addEventListener("mousedown", async (e) => {
  e.preventDefault();
  if (!(await armMic())) return;
  voiceMode = "ptt";
  listener.startPtt();
  applyOrb();
});
pttBtn.addEventListener("mouseup", () => {
  if (voiceMode === "ptt") {
    listener.endPtt();
    voiceMode = "off";
    applyOrb();
  }
});
pttBtn.addEventListener("mouseleave", () => {
  if (voiceMode === "ptt") {
    listener.endPtt();
    voiceMode = "off";
    applyOrb();
  }
});

window.addEventListener("error", (e) => {
  try {
    addMsg("jarvis", "Error en pantalla, Señor: " + ((e && e.message) || "desconocido") + ". El teclado sigue.");
  } catch {
    /* ignore */
  }
});
window.addEventListener("unhandledrejection", (e) => {
  try {
    const r = e && e.reason;
    addMsg("jarvis", "Algo falló, Señor: " + ((r && r.message) || r || "promesa") + ". Escribe otra vez.");
  } catch {
    /* ignore */
  }
});
boot();
window.addEventListener("pointerdown", onUserUnlock, true);
window.addEventListener("keydown", onUserUnlock, true);
window.addEventListener("focus", onUserUnlock);
