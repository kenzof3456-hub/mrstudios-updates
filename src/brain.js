const fs = require("fs");
const path = require("path");
const { detectIntent } = require("./intents");
const { describeProfile, address } = require("./profile");
const { formatNow } = require("./time");
const { openApp, closeApp, isWindows } = require("./windows-apps");
const { enableDiscordCamera } = require("./discord");
const { searchWeb, formatSearchAnswer } = require("./search");
const { chatWithLlm } = require("./llm");
const { say, aside } = require("./voice");
const { parseWake } = require("./wake");
const { pickWakeLine } = require("./spoken");
const { resolveVoice, catalog, formatVoiceLine } = require("./voices");
const { detectLanguage, languageName, localeFor, tx } = require("./lang");
const {
  isPiracy,
  pirateReply,
  localFallback,
  craftSystem,
  extractFiles,
  setLastFiles,
  getLastFiles,
  writeCraftFile,
} = require("./craft");
const { setLastJob, executeLast, writeAll } = require("./agency");

function systemPrompt(profile, memory, lang) {
  const langName = languageName(lang || profile.language || "es");
  return [
    `You are Jarvis, desktop assistant for ${profile.realName}.`,
    `Always call him ${address(profile)} (use Luis only if he asks his real name).`,
    `Reply in ${langName}. Match his language exactly.`,
    `Tone: warm, composed, a spark of wit when it fits. Not hyper. Not a joke every line. Not theatrical. Alive, not carnival.`,
    `Keep answers free-form but concise. Skip forced catchphrases.`,
    `You do not only advise: when he asks to make a file, script, or model, write it to disk. When he says hazme esto / házmelo / do this, execute the last or stated safe action.`,
    `Ask once before deleting files or installing unknowns. Refuse OS wipes (format disk, rm -rf /, factory reset). Original code only — never pirate paid mods.`,
    `System: ${profile.os}.`,
    `${address(profile)}'s memory:\n${memory.contextBlock()}`,
    `Use memories when they help. Cite web sources in one line.`,
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
  setLanguage,
  craftDir,
}) {
  const parsed = parseWake(text);
  const work = parsed.woke ? parsed.rest : text;
  const lang = detectLanguage(work || text, profile.language || "es");
  if (typeof setLanguage === "function") setLanguage(lang);
  if (profile) profile.language = lang;

  if (parsed.woke && !work) {
    return { reply: pickWakeLine(lang), intent: "wake", spokeWake: true, language: lang };
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
        reply: await sight.lookAttached(work || "mira esto", lang),
        intent: "look_attach",
      };
    }
  }

  if (intent.type === "empty") {
    return {
      reply: say(tx(lang, "Te escucho.", "I'm listening.")),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "agency_refuse") {
    return {
      reply: tx(
        lang,
        "Eso no. No formateo discos ni borro el sistema.",
        "No. I won't wipe disks or the OS."
      ),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "agency_ask") {
    return {
      reply: tx(
        lang,
        `¿Confirmas? «${intent.query}». Dilo una vez: sí o no.`,
        `Confirm once: “${intent.query}”. Yes or no.`
      ),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "agency_cancel") {
    return {
      reply: tx(lang, "Cancelado.", "Cancelled."),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "do_last") {
    const did = await executeLast(craftDir, lang);
    return { reply: did.reply, intent: intent.type, language: lang, saved: did.saved };
  }

  if (intent.type === "delete_file") {
    const name = String(intent.name || "").replace(/[/\\]/g, "");
    if (!craftDir || !name) {
      return {
        reply: tx(lang, "Dime el archivo de craft a borrar.", "Name the craft file to delete."),
        intent: intent.type,
        language: lang,
      };
    }
    const dest = path.join(craftDir, name);
    if (!dest.startsWith(craftDir) || !fs.existsSync(dest)) {
      return {
        reply: tx(lang, `No está en craft: ${name}`, `Not in craft: ${name}`),
        intent: intent.type,
        language: lang,
      };
    }
    fs.unlinkSync(dest);
    return {
      reply: tx(lang, `Borrado: ${dest}`, `Deleted: ${dest}`),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "list_voices") {
    const lines = catalog(extraVoices)
      .slice(0, 22)
      .map((v) => "· " + formatVoiceLine(v));
    return {
      reply: say(
        tx(lang, "Catálogo legal — no clones.", "Legal catalog — no clones."),
        lines.join("\n"),
        tx(lang, "Dime «habla con voz de Jorge» o usa el selector.", "Say “speak with Jorge’s voice” or use the picker.")
      ),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "set_voice") {
    const found = resolveVoice(intent.query, extraVoices);
    if (found.celebrity) {
      return {
        reply: say(tx(lang, "Eso no.", "I won't do that."), found.reason),
        intent: intent.type,
        language: lang,
      };
    }
    if (!found.ok) {
      return {
        reply: say(
          tx(lang, "No está en el catálogo.", "Not in the catalog."),
          `«${intent.query}»`,
          tx(lang, "Prueba Álvaro, Jorge, Ryan, Nova.", "Try Álvaro, Jorge, Ryan, Nova.")
        ),
        intent: intent.type,
        language: lang,
      };
    }
    if (typeof setVoice === "function") setVoice(found.voice);
    return {
      reply: say(
        tx(lang, "Hecho.", "Done."),
        tx(lang, `Hablo con ${formatVoiceLine(found.voice)}.`, `Speaking as ${formatVoiceLine(found.voice)}.`)
      ),
      intent: intent.type,
      voice: found.voice,
      language: lang,
    };
  }

  if (intent.type === "remember") {
    const fact = memory.add(intent.fact);
    if (!fact) {
      return {
        reply: say(tx(lang, "Dime qué guardar.", "Tell me what to keep.")),
        intent: intent.type,
        language: lang,
      };
    }
    return {
      reply: say(
        tx(lang, "Anotado.", "Noted."),
        `«${fact.text}»`
      ),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "recall") {
    const facts = memory.list();
    const extra = facts.length
      ? [
          tx(lang, "Lo que me has contado:", "What you've told me:"),
          ...facts.map((f, i) => `${i + 1}. ${f.text}`),
        ]
      : [tx(lang, "La libreta extra está vacía.", "The extra notebook is empty.")];
    return {
      reply: say(describeProfile(profile, lang), extra),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "forget") {
    const removed = memory.forget(intent.query);
    if (!removed.length) {
      return {
        reply: say(
          tx(lang, "No lo encuentro.", "I can't find that."),
          `«${intent.query}»`
        ),
        intent: intent.type,
        language: lang,
      };
    }
    return {
      reply: say(
        tx(lang, "Olvidado.", "Forgotten."),
        removed.map((f) => f.text).join("; ")
      ),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "forget_all") {
    const n = memory.forgetAll();
    return {
      reply: say(
        n === 0
          ? tx(lang, "Ya estaba vacía.", "It was already empty.")
          : tx(lang, `Borré ${n} recuerdos.`, `Cleared ${n} notes.`),
        tx(lang, `Sigo sabiendo que eres Luis y te llamo ${address(profile)}.`, `I still know you're Luis and I call you ${address(profile)}.`)
      ),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "datetime") {
    return {
      reply: say(formatNow(localeFor(lang), lang).text, aside(memory, "horario agenda", lang)),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "profile") {
    const extra = memory.list();
    const more = extra.length
      ? tx(lang, `Y me contaste: ${extra.map((f) => f.text).join("; ")}.`, `You've also said: ${extra.map((f) => f.text).join("; ")}.`)
      : "";
    return {
      reply: say(describeProfile(profile, lang), more),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "open_app") {
    const r = await openApp(intent.app);
    setLastJob({ type: "open_app", app: intent.app });
    return {
      reply: say(r.message, aside(memory, intent.app, lang)),
      intent: intent.type,
      ok: r.ok,
      language: lang,
    };
  }

  if (intent.type === "close_app") {
    const r = await closeApp(intent.app);
    return {
      reply: say(r.message, aside(memory, intent.app, lang)),
      intent: intent.type,
      ok: r.ok,
      language: lang,
    };
  }

  if (intent.type === "discord_camera") {
    const r = await enableDiscordCamera();
    return {
      reply: say(r.message, aside(memory, "discord camara atajo", lang)),
      intent: intent.type,
      ok: r.ok,
      did: r.did,
      language: lang,
    };
  }

  if (intent.type === "look_attach") {
    if (!sight) {
      return { reply: say(tx(lang, "Aún no tengo ojos.", "I don't have eyes yet.")), intent: intent.type, language: lang };
    }
    return { reply: await sight.lookAttached(intent.query, lang), intent: intent.type, language: lang };
  }

  if (intent.type === "look_screen") {
    if (!sight) {
      return { reply: say(tx(lang, "Aún no tengo ojos.", "I don't have eyes yet.")), intent: intent.type, language: lang };
    }
    return { reply: await sight.lookOnly(lang), intent: intent.type, language: lang };
  }

  if (intent.type === "look_ask" || intent.type === "screen_ask") {
    if (!sight) {
      return { reply: say(tx(lang, "Aún no tengo ojos.", "I don't have eyes yet.")), intent: intent.type, language: lang };
    }
    if (intent.type === "screen_ask" && !sight.has()) {
      return {
        reply: say(
          tx(lang, "Aún no he mirado.", "I haven't looked yet."),
          tx(lang, "Dime «mira mi pantalla» o pulsa Adjuntar.", "Say “look at my screen” or use Attach.")
        ),
        intent: intent.type,
        language: lang,
      };
    }
    const last = sight.getLast && sight.getLast();
    if (last && last.kind !== "image") {
      return {
        reply: await sight.lookAttached(intent.query, lang),
        intent: intent.type,
        language: lang,
      };
    }
    const reply = await sight.lookAndAnswer(intent.query, {
      recapture: intent.type === "look_ask",
      lang,
    });
    return { reply, intent: intent.type, language: lang };
  }

  if (intent.type === "save_code") {
    const files = getLastFiles();
    if (!files.length) {
      return {
        reply: tx(lang, "No hay código reciente. Pídeme un script primero.", "No recent code. Ask for a script first."),
        intent: intent.type,
        language: lang,
      };
    }
    if (!craftDir) {
      return {
        reply: tx(lang, "No pude elegir carpeta de guardado.", "Couldn't pick a save folder."),
        intent: intent.type,
        language: lang,
      };
    }
    const saved = files.map((f) => writeCraftFile(craftDir, f));
    setLastJob({ type: "craft", saved, files });
    return {
      reply: say(
        tx(lang, "Guardado.", "Saved."),
        saved.join("\n")
      ),
      intent: intent.type,
      language: lang,
      saved,
      files,
    };
  }

  if (intent.type === "craft") {
    if (isPiracy(intent.query)) {
      return { reply: pirateReply(lang), intent: intent.type, language: lang };
    }
    const llmText = await chatWithLlm({
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl,
      model: llm.model,
      timeout: 50000,
      messages: [
        { role: "system", content: systemPrompt(profile, memory, lang) + " " + craftSystem(languageName(lang)) },
        ...history.slice(-6),
        { role: "user", content: intent.query },
      ],
    });
    const local = localFallback(intent.query, lang);
    let reply =
      llmText ||
      (local && local.reply) ||
      tx(
        lang,
        "Sin API no genero código a medida. Prueba Blender, Discord bot, glTF, o pon OPENAI_API_KEY.",
        "Without an API I only have a few templates (Blender, Discord bot, glTF). Set OPENAI_API_KEY for custom code."
      );
    let files = extractFiles(reply, intent.query);
    if (!files.length && local && local.files) files = local.files;
    setLastFiles(files);
    let saved = [];
    if (files.length && craftDir) {
      saved = writeAll(craftDir, files);
      setLastJob({ type: "craft", saved, files });
      reply = say(
        reply,
        tx(lang, "Hecho. En disco:", "Done. On disk:"),
        saved.join("\n")
      );
    }
    return {
      reply,
      intent: intent.type,
      language: lang,
      files,
      saved,
      llm: Boolean(llmText),
    };
  }

  const results = await searchWeb(intent.query);
  const fallback = say(formatSearchAnswer(intent.query, results, lang), aside(memory, intent.query, lang));

  const llmText = await chatWithLlm({
    apiKey: llm.apiKey,
    baseUrl: llm.baseUrl,
    model: llm.model,
    messages: [
      { role: "system", content: systemPrompt(profile, memory, lang) },
      ...history.slice(-8),
      {
        role: "user",
        content:
          `${address(profile)}: ${intent.query}\n\n` +
          `Web:\n` +
          (results.length
            ? results
                .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`)
                .join("\n\n")
            : "(none)") +
          `\n\nReply in ${languageName(lang)}. Warm and concise. A little wit if it fits — not a joke every line. Cite 1-3 URLs at the end.`,
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
  const lang = (profile && profile.language) || "es";
  const { weekday, date, time, timeZone } = formatNow(localeFor(lang), lang);
  const win = isWindows
    ? tx(lang, "Apps y Discord listos.", "Apps and Discord are ready.")
    : tx(
        lang,
        "Fuera de Windows: charla, hora, memoria y búsqueda sí. Apps, en tu PC.",
        "Not on Windows: chat, time, memory, and search work. Apps wait for your PC."
      );
  const facts = memory && memory.list ? memory.list() : [];
  const wink = facts.length
    ? tx(lang, `${facts.length} notas guardadas.`, `${facts.length} notes saved.`)
    : "";
  return say(
    tx(lang, `En línea, ${address(profile)}.`, `Online, ${address(profile)}.`),
    `${time}. ${weekday}, ${date} (${timeZone}).`,
    tx(lang, "Adjuntar, mensajes, voces: abajo y arriba. Código y Blender: los escribo. Di «házmelo» y lo ejecuto.", "Attach, messages, voices: bottom and top. I write code and Blender scripts. Say “do this” and I execute."),
    win,
    wink
  );
}

module.exports = { handleTurn, greeting, systemPrompt };
