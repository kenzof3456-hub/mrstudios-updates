const { detectIntent } = require("./intents");
const { describeProfile } = require("./profile");
const { formatNow } = require("./time");
const { openApp, closeApp, isWindows } = require("./windows-apps");
const { enableDiscordCamera } = require("./discord");
const { searchWeb, formatSearchAnswer } = require("./search");
const { chatWithLlm } = require("./llm");

function systemPrompt(profile) {
  return [
    `Eres Jarvis, asistente de escritorio de ${profile.realName}.`,
    `Siempre te diriges a él como Rabbit (nunca solo por Luis salvo si pregunta su nombre real).`,
    `UI y respuestas en español, salvo que Rabbit escriba en inglés.`,
    `Sistema del usuario: ${profile.os}.`,
    `Eres directo, leal, tono JARVIS (elegante, breve).`,
    `Si usas búsqueda web, cita fuentes en una línea.`,
  ].join(" ");
}

async function handleTurn({ text, history, profile, llm }) {
  const intent = detectIntent(text);

  if (intent.type === "empty") {
    return { reply: "Rabbit, te escucho.", intent: intent.type };
  }

  if (intent.type === "datetime") {
    return { reply: formatNow(profile.locale).text, intent: intent.type };
  }

  if (intent.type === "profile") {
    return { reply: describeProfile(profile), intent: intent.type };
  }

  if (intent.type === "open_app") {
    const r = await openApp(intent.app);
    return { reply: r.message, intent: intent.type, ok: r.ok };
  }

  if (intent.type === "close_app") {
    const r = await closeApp(intent.app);
    return { reply: r.message, intent: intent.type, ok: r.ok };
  }

  if (intent.type === "discord_camera") {
    const r = await enableDiscordCamera();
    return { reply: r.message, intent: intent.type, ok: r.ok, did: r.did };
  }

  const results = await searchWeb(intent.query);
  const fallback = formatSearchAnswer(intent.query, results);

  const llmText = await chatWithLlm({
    apiKey: llm.apiKey,
    baseUrl: llm.baseUrl,
    model: llm.model,
    messages: [
      { role: "system", content: systemPrompt(profile) },
      ...history.slice(-8),
      {
        role: "user",
        content:
          `Pregunta de Rabbit: ${intent.query}\n\n` +
          `Resultados web:\n` +
          (results.length
            ? results
                .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`)
                .join("\n\n")
            : "(sin resultados)") +
          `\n\nResponde en español, dirígete a Rabbit, cita 1-3 URLs al final.`,
      },
    ],
  });

  return {
    reply: llmText || fallback,
    intent: "question",
    searched: true,
    sources: results.slice(0, 3).map((r) => r.url),
    llm: Boolean(llmText),
  };
}

function greeting(profile) {
  const { weekday, date, time, timeZone } = formatNow(profile.locale);
  const win = isWindows
    ? "Control de apps y Discord listo."
    : "Estoy en un entorno que no es Windows: chat, hora y búsqueda sí; abrir apps y cámara de Discord solo en tu PC.";
  return `Sistemas en línea. Hola, Rabbit. Son las ${time}. Hoy es ${weekday}, ${date} (zona ${timeZone}). ${win}`;
}

module.exports = { handleTurn, greeting, systemPrompt };
