const { detectIntent } = require("./intents");
const { describeProfile } = require("./profile");
const { formatNow } = require("./time");
const { openApp, closeApp, isWindows } = require("./windows-apps");
const { enableDiscordCamera } = require("./discord");
const { searchWeb, formatSearchAnswer } = require("./search");
const { chatWithLlm } = require("./llm");
const { say, aside } = require("./voice");
const { parseWake } = require("./wake");
const { pickWakeLine } = require("./spoken");
const { resolveVoice, catalog, formatVoiceLine } = require("./voices");

function systemPrompt(profile, memory) {
  return [
    `Eres Jarvis, asistente de escritorio de ${profile.realName}.`,
    `Siempre lo llamas Rabbit (solo usas Luis si pregunta su nombre real).`,
    `Español por defecto.`,
    `Personalidad: alegre, cálido, animado, ingenioso.`,
    `Voz EXPRESIVA en texto: líneas cortas, reacción primero (alegría, preocupación, humor, celebración).`,
    `Nunca plano, nunca robótico. TTS con energía (no monótono).`,
    `Sistema: ${profile.os}.`,
    `Memoria de Rabbit:\n${memory.contextBlock()}`,
    `Usa recuerdos cuando ayuden. Cita fuentes web en una línea.`,
  ].join(" ");
}

async function handleTurn({
  text,
  history,
  profile,
  llm,
  memory,
  sight,
  messenger,
  useAttach,
  setVoice,
  extraVoices,
}) {
  const parsed = parseWake(text);
  const work = parsed.woke ? parsed.rest : text;
  if (parsed.woke && !work) {
    return { reply: pickWakeLine(), intent: "wake", spokeWake: true };
  }

  const intent = detectIntent(work);

  if (messenger) {
    const sendReply = await messenger.handleTurnText(work, intent);
    if (sendReply) {
      return { reply: sendReply, intent: "send_message" };
    }
  }

  if (useAttach && sight) {
    if (
      intent.type === "empty" ||
      intent.type === "look_attach" ||
      intent.type === "screen_ask" ||
      intent.type === "look_ask" ||
      intent.type === "question"
    ) {
      return {
        reply: await sight.lookAttached(work || "mira esto"),
        intent: "look_attach",
      };
    }
  }

  if (intent.type === "empty") {
    return {
      reply: say("¡Ey, Rabbit!", "Te escucho.", "Tira la orden cuando quieras."),
      intent: intent.type,
    };
  }

  if (intent.type === "list_voices") {
    const lines = catalog(extraVoices)
      .slice(0, 22)
      .map((v) => "· " + formatVoiceLine(v));
    return {
      reply: say(
        "¡Claro, Rabbit! Catálogo legal, no clones.",
        lines.join("\n"),
        "Dime «habla con voz de Jorge» o usa el selector de arriba."
      ),
      intent: intent.type,
    };
  }

  if (intent.type === "set_voice") {
    const found = resolveVoice(intent.query, extraVoices);
    if (found.celebrity) {
      return {
        reply: say("Eso no, Rabbit.", found.reason, "El selector tiene decenas de voces legales."),
        intent: intent.type,
      };
    }
    if (!found.ok) {
      return {
        reply: say(
          "No la encuentro en el catálogo.",
          `Busqué «${intent.query}».`,
          "Prueba Álvaro, Jorge, Ryan, Nova, o «lista las voces»."
        ),
        intent: intent.type,
      };
    }
    if (typeof setVoice === "function") setVoice(found.voice);
    return {
      reply: say(
        "¡Cambio hecho!",
        `Ahora hablo con ${formatVoiceLine(found.voice)}.`,
        "Lo guardé en tu perfil. Si adjuntas un audio, no lo clono: elige del catálogo."
      ),
      intent: intent.type,
      voice: found.voice,
    };
  }

  if (intent.type === "remember") {
    const fact = memory.add(intent.fact);
    if (!fact) {
      return {
        reply: say(
          "¡Uy, se me escapó!",
          "Dime qué guardar, Rabbit.",
          "Una frase y lo anoto."
        ),
        intent: intent.type,
      };
    }
    return {
      reply: say(
        "¡Apuntado, Rabbit!",
        `Voy a recordar: «${fact.text}».`,
        "Pregúntame «qué sabes de mí» cuando quieras presumir mi memoria."
      ),
      intent: intent.type,
    };
  }

  if (intent.type === "recall") {
    const facts = memory.list();
    const extra = facts.length
      ? ["Esto me contaste (y no se me olvida):", ...facts.map((f, i) => `${i + 1}. ${f.text}`)]
      : [
          "La libreta extra está vacía… por ahora.",
          "Cuéntame un gusto, un atajo, un horario. ¡Lo celebro y lo guardo!",
        ];
    return {
      reply: say("¡Me encanta esta pregunta!", describeProfile(profile), extra),
      intent: intent.type,
    };
  }

  if (intent.type === "forget") {
    const removed = memory.forget(intent.query);
    if (!removed.length) {
      return {
        reply: say(
          "Mmm… no lo encuentro.",
          `Busqué «${intent.query}» y la libreta no dice nada.`,
          "¿Lo decimos con otras palabras, Rabbit?"
        ),
        intent: intent.type,
      };
    }
    return {
      reply: say(
        "Hecho. Borrón y cuenta nueva.",
        `Olvidé: ${removed.map((f) => f.text).join("; ")}.`,
        "Como si nunca lo hubiera oído. (El perfil Luis/Rabbit se queda, tranquilo.)"
      ),
      intent: intent.type,
    };
  }

  if (intent.type === "forget_all") {
    const n = memory.forgetAll();
    return {
      reply: say(
        n === 0
          ? "¡Ja! La libreta extra ya estaba vacía."
          : `¡Limpieza total! Fuera ${n} recuerdo${n === 1 ? "" : "s"}.`,
        "Sigo sabiendo que eres Luis y te llamo Rabbit.",
        "Cuando quieras, empezamos a llenarla otra vez."
      ),
      intent: intent.type,
    };
  }

  if (intent.type === "datetime") {
    return {
      reply: say(formatNow(profile.locale).text, aside(memory, "horario agenda")),
      intent: intent.type,
    };
  }

  if (intent.type === "profile") {
    const extra = memory.list();
    const more = extra.length
      ? `Y de lo que me has contado: ${extra.map((f) => f.text).join("; ")}.`
      : "Si me sueltas un secreto inofensivo… ¡lo guardo con cariño!";
    return {
      reply: say("¡Obvio que te conozco!", describeProfile(profile), more),
      intent: intent.type,
    };
  }

  if (intent.type === "open_app") {
    const r = await openApp(intent.app);
    return {
      reply: say(r.message, aside(memory, intent.app)),
      intent: intent.type,
      ok: r.ok,
    };
  }

  if (intent.type === "close_app") {
    const r = await closeApp(intent.app);
    return {
      reply: say(r.message, aside(memory, intent.app)),
      intent: intent.type,
      ok: r.ok,
    };
  }

  if (intent.type === "discord_camera") {
    const r = await enableDiscordCamera();
    return {
      reply: say(r.message, aside(memory, "discord camara atajo")),
      intent: intent.type,
      ok: r.ok,
      did: r.did,
    };
  }

  if (intent.type === "look_attach") {
    if (!sight) {
      return { reply: say("Aún no tengo ojos, Rabbit."), intent: intent.type };
    }
    return { reply: await sight.lookAttached(intent.query), intent: intent.type };
  }

  if (intent.type === "look_screen") {
    if (!sight) {
      return { reply: say("Aún no tengo ojos, Rabbit."), intent: intent.type };
    }
    return { reply: await sight.lookOnly(), intent: intent.type };
  }

  if (intent.type === "look_ask" || intent.type === "screen_ask") {
    if (!sight) {
      return { reply: say("Aún no tengo ojos, Rabbit."), intent: intent.type };
    }
    if (intent.type === "screen_ask" && !sight.has()) {
      return {
        reply: say(
          "Aún no he mirado nada, Rabbit.",
          "Dime «mira mi pantalla» o pulsa Adjuntar y luego «mira esto».",
          "Nunca miro el monitor si tú no me lo pides."
        ),
        intent: intent.type,
      };
    }
    const last = sight.getLast && sight.getLast();
    if (last && last.kind !== "image") {
      return {
        reply: await sight.lookAttached(intent.query),
        intent: intent.type,
      };
    }
    const reply = await sight.lookAndAnswer(intent.query, {
      recapture: intent.type === "look_ask",
    });
    return { reply, intent: intent.type };
  }

  const results = await searchWeb(intent.query);
  const fallback = say(formatSearchAnswer(intent.query, results), aside(memory, intent.query));

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
          `\n\nResponde en español a Rabbit. Empieza con una reacción (¡wow!, preocupación, chiste corto). Líneas cortas. Cita 1-3 URLs al final.`,
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
    ? "Apps y Discord: listos. Dime y salto."
    : "Estoy fuera de Windows: charla, hora, memoria y búsqueda sí. Apps y cámara de Discord… en tu PC, Rabbit.";
  const facts = memory && memory.list ? memory.list() : [];
  const wink = facts.length
    ? `¡Y oye! Tengo ${facts.length} nota${facts.length === 1 ? "" : "s"} tuyas guardadas.`
    : "Si me cuentas algo de ti, lo celebro… y lo apunto.";
  return say(
    "¡Sistemas en línea, Rabbit!",
    "Qué alegría verte.",
    `Son las ${time}. Hoy es ${weekday}, ${date} (${timeZone}).`,
    "Mensajes: «manda a mamá por WhatsApp que ya voy». Si no dices app, miro la memoria o te pregunto una vez.",
    "Fotos y archivos: pulsa Adjuntar. Quedan en el PC; visión solo con tu API.",
    "Voz: selector arriba, o «habla con voz de Jorge». La de fábrica es Álvaro, estilo mayordomo legal.",
    win,
    wink
  );
}

module.exports = { handleTurn, greeting, systemPrompt };
