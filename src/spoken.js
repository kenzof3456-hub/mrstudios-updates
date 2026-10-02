function squash(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  const flat = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return [];
  const parts = flat
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  return parts.length ? parts : [flat];
}

function isStatusDump(text) {
  const t = String(text || "");
  if (/notas guardadas/i.test(t)) return true;
  if (/Adjuntar/i.test(t) && /mensajes/i.test(t) && /voces/i.test(t)) return true;
  return false;
}

function bootLine(lang, who) {
  const name = who || "Señor";
  return lang === "en" ? `Online, ${name}.` : `En línea, ${name}.`;
}

function capSpoken(text, opts = {}) {
  const lang = opts.lang || "es";
  const who = opts.who || "Señor";
  if (isStatusDump(text)) return bootLine(lang, who);
  let sents = splitSentences(text).map((s) => s.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim());
  sents = sents.filter(Boolean);
  if (opts.search) {
    sents = sents
      .filter((s) => !/^(fuentes|sources)\b/i.test(s))
      .slice(0, 2);
  } else if (opts.code) {
    sents = sents.slice(0, 8);
    if (!sents.length) {
      return lang === "en" ? `The code is in the chat, ${who}.` : `El código está en el chat, ${who}.`;
    }
  } else {
    sents = sents.slice(0, 3);
  }
  return sents.join(" ").replace(/\s+/g, " ").trim();
}

function isEcho(heard, spoken) {
  const h = squash(heard);
  const p = squash(spoken);
  if (!h || !p || h === "jarvis") return false;
  if (h === p) return true;
  if (h.length >= 12 && (p.includes(h) || h.includes(p))) return true;
  const pt = p.split(" ").filter((w) => w.length > 2);
  if (pt.length < 4) return false;
  const ht = new Set(h.split(" "));
  const hit = pt.filter((w) => ht.has(w)).length;
  return hit / pt.length >= 0.75;
}

function forSpeech(text, opts) {
  return capSpoken(text, opts || {});
}

const GREETINGS = {
  es: [
    "Aquí estoy, Señor.",
    "Te escuché.",
    "Dime.",
  ],
  en: [
    "I'm here, Señor.",
    "Heard you.",
    "Go ahead.",
  ],
};

const WITS = {
  es: [
    "Jarvis al habla. Sin traje de metal, con café virtual.",
    "Nombre recibido. ¿Seguimos?",
  ],
  en: [
    "Jarvis here. No metal suit. Still useful.",
    "Got the name. What's next?",
  ],
};

function pickWakeLine(lang) {
  const code = lang === "es" ? "es" : "en";
  if (Math.random() < 0.22) {
    const pool = WITS[code];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = GREETINGS[code];
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  pickWakeLine,
  forSpeech,
  GREETINGS,
  WITS,
  capSpoken,
  isEcho,
  isStatusDump,
  bootLine,
  splitSentences,
  squash,
};
