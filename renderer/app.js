const logEl = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const pill = document.getElementById("status-pill");
const ear = document.getElementById("ear");
const alwaysBtn = document.getElementById("mic-always");
const pttBtn = document.getElementById("mic-ptt");

const history = [];
let speaking = false;
let awaitCommand = false;
let voiceMode = "off";
let listener = null;

function addMsg(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "jarvis" ? "JARVIS" : "RABBIT";
  el.appendChild(who);
  el.appendChild(document.createTextNode(text));
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
}

async function talk(text) {
  speaking = true;
  try {
    if (listener && voiceMode === "always") listener.stop();
    await window.speakOut(text);
  } finally {
    speaking = false;
    if (voiceMode === "always" && listener) listener.startAlways();
  }
}

async function send(text, { fromVoice = false } = {}) {
  const trimmed = text.trim();
  if (!trimmed) return;
  addMsg("user", trimmed);
  history.push({ role: "user", content: trimmed });
  input.value = "";
  sendBtn.disabled = true;
  try {
    const res = await window.jarvis.chat(trimmed, history.slice(0, -1));
    const reply = res.reply || "Sin respuesta.";
    addMsg("jarvis", reply);
    history.push({ role: "assistant", content: reply });
    await talk(reply);
  } catch (err) {
    const msg = "Fallo de enlace, Rabbit: " + err.message;
    addMsg("jarvis", msg);
    if (fromVoice) await talk(msg);
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
      await send(parsed.rest, { fromVoice: true });
    } else {
      awaitCommand = true;
      ear.textContent = "OÍDO: ORDEN…";
    }
    return;
  }
  if (awaitCommand || voiceMode === "ptt") {
    awaitCommand = false;
    await send(finalText, { fromVoice: true });
  }
}

function onListenError(err) {
  if (ear) ear.textContent = "MIC: " + err;
}

async function armMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    addMsg(
      "jarvis",
      "¡Ojo, Rabbit! No hay micrófono. En Windows: Configuración → Privacidad → Micrófono → permitir apps de escritorio, y acepta el aviso de Electron."
    );
    return false;
  }
}

async function boot() {
  try {
    const s = await window.jarvis.status();
    if (!s.isWindows) pill.textContent = "MODO DEV · NO WINDOWS";
    if (!s.hasLlm) pill.title = "Sin OPENAI_API_KEY: TTS local (SAPI / voces del sistema) y búsqueda siguen.";
    addMsg("jarvis", s.greeting);
    await talk(s.greeting);
  } catch (err) {
    addMsg("jarvis", "Rabbit, no pude iniciar el núcleo: " + err.message);
  }

  if (!window.speechSupported || !window.speechSupported()) {
    ear.textContent = "STT NO DISPONIBLE";
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

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send(input.value);
  }
});

for (const btn of document.querySelectorAll(".chips button[data-q]")) {
  btn.addEventListener("click", () => send(btn.dataset.q));
}

alwaysBtn.addEventListener("click", async () => {
  if (voiceMode === "always") {
    voiceMode = "off";
    listener && listener.stop();
    alwaysBtn.classList.remove("on");
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
});
pttBtn.addEventListener("mouseup", () => {
  if (voiceMode === "ptt") listener.endPtt();
});
pttBtn.addEventListener("mouseleave", () => {
  if (voiceMode === "ptt") listener.endPtt();
});

boot();
