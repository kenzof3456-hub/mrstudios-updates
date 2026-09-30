const logEl = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const pill = document.getElementById("status-pill");

const history = [];

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

async function boot() {
  try {
    const s = await window.jarvis.status();
    if (!s.isWindows) pill.textContent = "MODO DEV · NO WINDOWS";
    if (!s.hasLlm) pill.title = "Sin OPENAI_API_KEY: hora, apps, Discord y búsqueda local siguen activos.";
    addMsg("jarvis", s.greeting);
  } catch (err) {
    addMsg("jarvis", "Rabbit, no pude iniciar el núcleo: " + err.message);
  }
}

async function send(text) {
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
  } catch (err) {
    addMsg("jarvis", "Fallo de enlace, Rabbit: " + err.message);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
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

for (const btn of document.querySelectorAll(".chips button")) {
  btn.addEventListener("click", () => send(btn.dataset.q));
}

boot();
