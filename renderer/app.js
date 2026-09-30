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

const history = [];
let speaking = false;
let awaitCommand = false;
let voiceMode = "off";
let listener = null;
let pendingAttach = null;

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
  if (awaitCommand || voiceMode === "ptt") return "listen";
  return "idle";
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
  who.textContent = role === "jarvis" ? "JARVIS" : "RABBIT";
  el.appendChild(who);
  el.appendChild(document.createTextNode(text));
  logEl.appendChild(el);
  while (logEl.children.length > 8) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
  if (role === "jarvis" && caption) caption.textContent = text.split("\n")[0];
}

async function talk(text) {
  speaking = true;
  applyOrb();
  try {
    if (listener && voiceMode === "always") listener.stop();
    await window.speakOut(text, (lvl) => window.orbSetLevel && window.orbSetLevel(lvl));
  } finally {
    speaking = false;
    if (voiceMode === "always" && listener) listener.startAlways();
    applyOrb();
  }
}

async function send(text) {
  const trimmed = (text || "").trim();
  const withFile = Boolean(pendingAttach);
  if (!trimmed && !withFile) return;
  const spoken = trimmed || "mira esto";
  addMsg("user", withFile ? spoken + "  ·  " + pendingAttach.name : spoken);
  history.push({ role: "user", content: spoken });
  input.value = "";
  sendBtn.disabled = true;
  const useAttach = withFile;
  try {
    const res = await window.jarvis.chat(spoken, history.slice(0, -1), { useAttach });
    const reply = res.reply || "Sin respuesta.";
    addMsg("jarvis", reply);
    history.push({ role: "assistant", content: reply });
    if (useAttach) hideAttach();
    if (res.voice) await fillVoices();
    if (res.language) {
      const stt = {
        es: "es-MX",
        en: "en-GB",
        pt: "pt-BR",
        fr: "fr-FR",
        de: "de-DE",
        it: "it-IT",
        ja: "ja-JP",
        zh: "zh-CN",
        ko: "ko-KR",
      };
      window.__jarvisSttLang = stt[res.language] || "es-MX";
    }
    await talk(reply);
  } catch (err) {
    const msg = "Fallo de enlace, Rabbit: " + err.message;
    addMsg("jarvis", msg);
    await talk(msg);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

async function onHeard(finalText) {
  if (speaking) return;
  const parsed = await window.jarvis.parseWake(finalText);
  if (parsed.woke) {
    const line = await window.jarvis.wakeLine();
    addMsg("jarvis", line);
    await talk(line);
    if (parsed.rest) {
      awaitCommand = false;
      applyOrb();
      await send(parsed.rest);
    } else {
      awaitCommand = true;
      ear.textContent = "ESCUCHANDO";
      applyOrb();
    }
    return;
  }
  if (awaitCommand || voiceMode === "ptt") {
    awaitCommand = false;
    applyOrb();
    await send(finalText);
  }
}

window.__jarvisHeard = onHeard;

function onListenError(err) {
  if (ear) ear.textContent = "MIC " + err;
}

async function armMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    addMsg(
      "jarvis",
      "¡Ojo, Rabbit! No hay micrófono. En Windows: Privacidad → Micrófono → apps de escritorio."
    );
    return false;
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
    if (!s.isWindows) pill.textContent = "DEV";
    window.__jarvisIsWindows = Boolean(s.isWindows);
    window.__jarvisSttLang = (s.profile && s.profile.locale) || "es-MX";
    if (window.waitVoices) await window.waitVoices();
    await fillVoices();
    addMsg("jarvis", s.greeting);
    await talk(s.greeting);
  } catch (err) {
    addMsg("jarvis", "No pude iniciar el núcleo: " + err.message);
  }

  if (!window.speechSupported || !window.speechSupported()) {
    ear.textContent = "SIN STT";
    alwaysBtn.disabled = true;
    pttBtn.disabled = true;
    return;
  }

  listener = window.createListener({
    onFinal: onHeard,
    onError: onListenError,
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  send(input.value);
});

attachBtn.addEventListener("click", async () => {
  try {
    const picked = await window.jarvis.pickFile();
    if (!picked || picked.cancelled) return;
    if (!picked.ok) {
      addMsg("jarvis", picked.error || "No pude adjuntar eso, Rabbit.");
      return;
    }
    showAttach(picked);
    addMsg("jarvis", "Adjunto listo: «" + picked.name + "». Envía vacío o di «mira esto».");
  } catch (err) {
    addMsg("jarvis", "No pude abrir el archivo: " + err.message);
  }
});

attachClear.addEventListener("click", () => hideAttach());

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
    await talk("Así sueno ahora, Rabbit. " + o.dataset.label + ".");
  });
}

for (const btn of document.querySelectorAll(".chips button[data-q]")) {
  btn.addEventListener("click", () => send(btn.dataset.q));
}

alwaysBtn.addEventListener("click", async () => {
  if (voiceMode === "always") {
    voiceMode = "off";
    listener && listener.stop();
    alwaysBtn.classList.remove("on");
    applyOrb();
    return;
  }
  if (!(await armMic())) return;
  voiceMode = "always";
  alwaysBtn.classList.add("on");
  listener.startAlways();
});

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

boot();
