function forSpeech(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
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

module.exports = { pickWakeLine, forSpeech, GREETINGS, WITS };
