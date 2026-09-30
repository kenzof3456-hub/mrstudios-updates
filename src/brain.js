const { detectIntent } = require("./intents");
const { describeProfile } = require("./profile");
const { formatNow } = require("./time");
const { openApp, closeApp, isWindows } = require("./windows-apps");
const { enableDiscordCamera } = require("./discord");
const { searchWeb, formatSearchAnswer } = require("./search");
const { chatWithLlm } = require("./llm");

function systemPrompt(profile, memory) {
  return [
    `Eres Jarvis, asistente de escritorio de ${profile.realName}.`,
    `Siempre lo llamas Rabbit (solo usas Luis si pregunta su nombre real).`,
    `Español por defecto. Si Rabbit escribe en inglés, puedes responder en inglés.`,
    `Personalidad: alegre, cálido, animado, un poco ingenioso. Nunca sombrío, frío ni rígido.`,
    `Sistema del usuario: ${profile.os}.`,
    `Memoria local de Rabbit:\n${memory.contextBlock()}`,
    `Usa esos recuerdos cuando ayuden. Si usas búsqueda web, cita fuentes en una línea.`,
  ].join(" ");
}

function hint(memory, text) {
  const rel = memory.relatedTo(text).slice(0, 2);
  if (!rel.length) return "";
  return ` Por cierto, me acordé: ${rel.map((f) => f.text).join("; ")}.`;
}

async function handleTurn({ text, history, profile, llm, memory }) {
  const intent = detectIntent(text);

  if (intent.type === "empty") {
    return {
      reply: "¡Aquí estoy, Rabbit! Dime qué hacemos.",
      intent: intent.type,
    };
  }

  if (intent.type === "remember") {
    const fact = memory.add(intent.fact);
    if (!fact) {
      return {
        reply: "Casi, Rabbit. Dime qué quieres que recuerde, y lo anoto al instante.",
        intent: intent.type,
      };
    }
    return {
      reply: `¡Apuntado, Rabbit! Voy a recordar: «${fact.text}». Cuando quieras, pregunta «qué sabes de mí».`,
      intent: intent.type,
    };
  }

  if (intent.type === "recall") {
    const facts = memory.list();
    const core =
      describeProfile(profile) +
      (facts.length
        ? `\nTambién guardé esto de ti:\n${facts.map((f, i) => `${i + 1}. ${f.text}`).join("\n")}`
        : "\nTodavía no me has pedido que recuerde preferencias extra, pero estoy listo cuando quieras.");
    return { reply: core, intent: intent.type };
  }

  if (intent.type === "forget") {
    const removed = memory.forget(intent.query);
    if (!removed.length) {
      return {
        reply: `Busqué «${intent.query}» en mi libreta y no encontré ese dato, Rabbit. ¿Lo decimos de otra forma?`,
        intent: intent.type,
      };
    }
    return {
      reply: `Listo, Rabbit. Olvidé: ${removed.map((f) => f.text).join("; ")}. Como si no hubiera pasado.`,
      intent: intent.type,
    };
  }

  if (intent.type === "forget_all") {
    const n = memory.forgetAll();
    return {
      reply:
        n === 0
          ? "La libreta extra ya estaba vacía, Rabbit. Sigo sabiendo que eres Luis y te llamo Rabbit."
          : `Hecho, Rabbit. Borré ${n} recuerdo${n === 1 ? "" : "s"} extra. El perfil (Luis / Rabbit / Windows) se queda.`,
      intent: intent.type,
    };
  }

  if (intent.type === "datetime") {
    return {
      reply: formatNow(profile.locale).text + hint(memory, "horario agenda"),
      intent: intent.type,
    };
  }

  if (intent.type === "profile") {
    const extra = memory.list();
    const more = extra.length
      ? ` Y de lo que me has contado: ${extra.map((f) => f.text).join("; ")}.`
      : " Si me cuentas preferencias, las guardo.";
    return { reply: describeProfile(profile) + more, intent: intent.type };
  }

  if (intent.type === "open_app") {
    const r = await openApp(intent.app);
    return {
      reply: r.message + hint(memory, intent.app),
      intent: intent.type,
      ok: r.ok,
    };
  }

  if (intent.type === "close_app") {
    const r = await closeApp(intent.app);
    return {
      reply: r.message + hint(memory, intent.app),
      intent: intent.type,
      ok: r.ok,
    };
  }

  if (intent.type === "discord_camera") {
    const r = await enableDiscordCamera();
    return {
      reply: r.message + hint(memory, "discord camara atajo"),
      intent: intent.type,
      ok: r.ok,
      did: r.did,
    };
  }

  const results = await searchWeb(intent.query);
  const fallback = formatSearchAnswer(intent.query, results) + hint(memory, intent.query);

  const llmText = await chatWithLlm({
    apiKey: llm.apiKey,
    baseUrl: llm.baseUrl,
    model: llm.model,
    messages: [
      { role: "system", content: systemPrompt(profile, memory) },
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
          `\n\nResponde en español, alegre y cercano, dirígete a Rabbit, cita 1-3 URLs al final.`,
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

function greeting(profile, memory) {
  const { weekday, date, time, timeZone } = formatNow(profile.locale);
  const win = isWindows
    ? "Apps y Discord listos cuando los pidas."
    : "Estoy en un entorno que no es Windows: chat, hora, memoria y búsqueda sí; abrir apps y cámara de Discord solo en tu PC.";
  const facts = memory && memory.list ? memory.list() : [];
  const wink = facts.length
    ? ` Todavía tengo ${facts.length} nota${facts.length === 1 ? "" : "s"} tuyas en la libreta.`
    : " Si me cuentas algo de ti, lo guardo.";
  return `¡Sistemas en línea, Rabbit! Qué gusto. Son las ${time}. Hoy es ${weekday}, ${date} (zona ${timeZone}). ${win}${wink}`;
}

module.exports = { handleTurn, greeting, systemPrompt };
