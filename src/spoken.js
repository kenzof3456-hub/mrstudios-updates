const GREETINGS = [
  "¡Rabbit! Aquí estoy. Dime qué hacemos.",
  "¡Ey, Rabbit! Te escuché. Soy todo oídos.",
  "¡Presente, Rabbit! ¿A qué le tiramos?",
  "¡Hola, Rabbit! Encendido y de buen humor.",
];

const JOKES = [
  "Rabbit, si yo fuera un café… sería espresso. Corto, intenso, y llegué ya.",
  "¿Romper Windows? Jamás. Prefiero abrirte las apps, no el sistema.",
  "Jarvis al habla. No, no traigo traje de metal. Traigo chistes malos y Discord.",
  "Te escuché decir mi nombre. Eso cuenta como cumplido, Rabbit.",
];

function pickWakeLine() {
  const pool = Math.random() < 0.5 ? GREETINGS : JOKES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function forSpeech(text) {
  return String(text || "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { pickWakeLine, forSpeech, GREETINGS, JOKES };
