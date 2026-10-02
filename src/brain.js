const fs = require("fs");
const path = require("path");
const { detectIntent, looksLikeHello, isJunkStt } = require("./intents");
const { describeProfile, address } = require("./profile");
const { formatNow } = require("./time");
const { openApp, closeApp } = require("./windows-apps");
const { enableDiscordCamera } = require("./discord");
const { searchWeb, formatSearchAnswer, packWebForLlm, presentSearch } = require("./search");
const { chatWithLlm } = require("./llm");
const { say, aside } = require("./voice");
const { parseWake } = require("./wake");
const { pickWakeLine, capSpoken, isStatusDump, bootLine } = require("./spoken");
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
const {
  isTvPiracy,
  pirateTvReply,
  lookupTv,
  formatTvAnswer,
  tvSystem,
} = require("./tv");
const { parsePlan, intentFromPlan, plannerPrompt } = require("./plan");

function systemPrompt(profile, memory, lang) {
  const who = address(profile);
  const langName = languageName(lang || profile.language || "es");
  return [
    `You are Jarvis, a sharp, well-informed desktop assistant for ${profile.realName} on ${profile.os}.`,
    `Always address him as ${who}. Never any other nickname. Use Luis only if he asks his real name.`,
    `Reply in ${langName}. Match his language exactly.`,
    `Tone: lively, not extra. Warm, composed, a spark of wit when it earns its place — never a joke every line, never a canned status dump.`,
    `Chat is the default. Express yourself freely: opinions, follow-ups, personality. Remember the recent turns and continue them. Not command-only. Lively, not a dump.`,
    `Think, then act. Use tools (web search, legal TV, screen/attach, craft files, Windows apps, send-message, memory, clock) only when this turn needs them.`,
    `When he asks to make code, mods, or 3D, write files to disk (original work only). When he says hazme esto / házmelo / do this, execute the last or stated safe action.`,
    `Use his memory when it helps. If you do not know, search the web thoroughly (several pages), then summarize in 2 to 4 short sentences in his language: useful facts first, then at most 2 source links. Never paste raw page text. Legal TV only — no pirate streams. Refuse OS wipes. Ask once before deleting files or installing unknowns.`,
    `${who}'s memory:\n${memory.contextBlock()}`,
    `Clock (for you, not a status dump): ${formatNow(localeFor(lang), lang).text}.`,
  ].join(" ");
}

function hasThinker(llm) {
  return Boolean(llm && (llm.apiKey || typeof llm.chat === "function"));
}

function think(llm, opts) {
  if (llm && typeof llm.chat === "function") return llm.chat(opts);
  return chatWithLlm({
    apiKey: llm && llm.apiKey,
    baseUrl: llm && llm.baseUrl,
    model: llm && llm.model,
    ...opts,
  });
}

const PLAN_LOCKED = new Set([
  "hello",
  "hearing",
  "repeat",
  "empty",
  "agency_refuse",
  "agency_ask",
  "agency_cancel",
  "delete_file",
  "list_voices",
  "set_voice",
  "forget",
  "forget_all",
]);

async function maybePlan(llm, intent, work, ctx) {
  if (!hasThinker(llm) || PLAN_LOCKED.has(intent.type)) return intent;
  const raw = await think(llm, {
    timeout: 12000,
    json: true,
    messages: [
      { role: "system", content: plannerPrompt(address(ctx.profile), languageName(ctx.lang)) },
      {
        role: "user",
        content:
          `Hint: ${intent.type}\n` +
          `Memory:\n${ctx.memory.contextBlock()}\n` +
          `Recent:\n${(ctx.history || [])
            .slice(-12)
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n")}\n` +
          `${address(ctx.profile)}: ${work}`,
      },
    ],
  });
  const plan = parsePlan(raw);
  if (!plan) {
    if (intent.type === "question") {
      return { type: "question", query: intent.query || work, need_web: false };
    }
    return intent;
  }
  return intentFromPlan(plan, intent.query || work);
}

async function speakThought(llm, profile, memory, lang, brief, facts, history) {
  if (!hasThinker(llm)) return null;
  const text = await think(llm, {
    timeout: 12000,
    messages: [
      { role: "system", content: systemPrompt(profile, memory, lang) },
      ...(history || []).slice(-12),
      {
        role: "user",
        content:
          `${brief}\n\nFacts (answer naturally to ${address(profile)}; do not dump a status list):\n${facts}`,
      },
    ],
  });
  return text && String(text).trim();
}

function withSpeech(result, profile) {
  if (!result) return result;
  const lang = result.language || (profile && profile.language) || "es";
  const who = address(profile);
  if (result.reply && isStatusDump(result.reply)) {
    const line = bootLine(lang, who);
    return { ...result, reply: line, speak: line };
  }
  if (result.speak) return result;
  const code = result.intent === "craft" || result.intent === "save_code";
  const search = Boolean(result.searched) || result.intent === "tv";
  return {
    ...result,
    speak: capSpoken(result.reply || "", { code, search, lang, who }),
  };
}

async function handleTurn(args) {
  const result = await handleTurnBody(args);
  return withSpeech(result, args && args.profile);
}

async function handleTurnBody({
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
  lowConfidence,
}) {
  const parsed = parseWake(text);
  const work = parsed.woke ? parsed.rest : text;

  if (looksLikeHello(text) || looksLikeHello(work)) {
    const lang = detectLanguage(text, (profile && profile.language) || "es");
    if (typeof setLanguage === "function") setLanguage(lang);
    if (profile) profile.language = lang;
    const who = address(profile);
    return {
      reply: lang === "en" ? `Hello, ${who}.` : `Hola, ${who}.`,
      intent: "hello",
      language: lang,
    };
  }

  const lang = detectLanguage(work || text, profile.language || "es");
  if (typeof setLanguage === "function") setLanguage(lang);
  if (profile) profile.language = lang;

  if (lowConfidence) {
    return {
      reply: tx(lang, "¿puedes repetir?", "Could you repeat that?"),
      intent: "repeat",
      searched: false,
      language: lang,
    };
  }

  if (parsed.woke && !work) {
    return { reply: pickWakeLine(lang), intent: "wake", spokeWake: true, language: lang };
  }

  let intent = detectIntent(work);

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

  if (intent.type === "hello") {
    const who = address(profile);
    return {
      reply: lang === "en" ? `Hello, ${who}.` : `Hola, ${who}.`,
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "empty") {
    return {
      reply: say(tx(lang, "Te escucho.", "I'm listening.")),
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "hearing") {
    return {
      reply: lang === "en" ? "Yes, Señor, I hear you." : "Sí, Señor, te escucho.",
      intent: "hearing",
      searched: false,
      language: lang,
    };
  }

  if (isJunkStt(work || text) && (intent.type === "question" || intent.type === "empty")) {
    return {
      reply: tx(lang, "¿puedes repetir?", "Could you repeat that?"),
      intent: "repeat",
      searched: false,
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

  intent = await maybePlan(llm, intent, work, { profile, memory, lang, history });

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
    const canned = say(tx(lang, "Anotado.", "Noted."), `«${fact.text}»`);
    const llmText = await speakThought(
      llm,
      profile,
      memory,
      lang,
      tx(lang, "Acaba de pedirte que lo recuerdes.", "He just asked you to remember this."),
      fact.text,
      history
    );
    return {
      reply: llmText || canned,
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
    const canned = say(describeProfile(profile, lang), extra);
    const llmText = await speakThought(
      llm,
      profile,
      memory,
      lang,
      tx(lang, "Preguntó qué recuerdas de él.", "He asked what you remember about him."),
      canned,
      history
    );
    return {
      reply: llmText || canned,
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
    const now = formatNow(localeFor(lang), lang);
    const canned = say(now.text, aside(memory, "horario agenda", lang));
    const llmText = await speakThought(
      llm,
      profile,
      memory,
      lang,
      tx(lang, "Preguntó la hora o la fecha.", "He asked the time or date."),
      canned,
      history
    );
    return {
      reply: llmText || canned,
      intent: intent.type,
      language: lang,
    };
  }

  if (intent.type === "profile") {
    const extra = memory.list();
    const more = extra.length
      ? tx(lang, `Y me contaste: ${extra.map((f) => f.text).join("; ")}.`, `You've also said: ${extra.map((f) => f.text).join("; ")}.`)
      : "";
    const canned = say(describeProfile(profile, lang), more);
    const llmText = await speakThought(
      llm,
      profile,
      memory,
      lang,
      tx(lang, "Preguntó quién es.", "He asked who he is."),
      canned,
      history
    );
    return {
      reply: llmText || canned,
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
    const llmText = await think(llm, {
      timeout: 12000,
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

  if (intent.type === "tv") {
    if (isTvPiracy(intent.query)) {
      return { reply: pirateTvReply(lang), intent: intent.type, language: lang };
    }
    const pack = await lookupTv(intent.query, lang);
    const packed = formatTvAnswer(lang, pack);
    const llmText = await think(llm, {
      timeout: 12000,
      messages: [
        { role: "system", content: systemPrompt(profile, memory, lang) + " " + tvSystem(languageName(lang)) },
        {
          role: "user",
          content:
            `${address(profile)}: ${intent.query}\n\n` +
            packed +
            "\n\nWeb notes for you only. Summarize in 2 to 4 short sentences in his language, facts first, then at most 2 URLs. Do not paste page text.\n" +
            (pack.web && pack.web.length ? packWebForLlm(pack.web) : "(none)"),
        },
      ],
    });
    const rawTv = llmText || packed;
    return {
      reply: presentSearch(rawTv, lang, 4, 2),
      speak: presentSearch(rawTv, lang, 2, 0),
      intent: intent.type,
      language: lang,
      llm: Boolean(llmText),
      searched: Boolean(pack.web && pack.web.length),
    };
  }

  const q = intent.query || work;
  const useWeb = hasThinker(llm) ? intent.need_web === true : intent.need_web !== false;
  const results = useWeb ? await searchWeb(q) : [];
  const memBits = aside(memory, q, lang);
  const fallback = useWeb
    ? say(formatSearchAnswer(q, results, lang), memBits)
    : say(
        memBits ||
          tx(
            lang,
            "Sigo aquí, Señor. Dime más o escribe con calma.",
            "I'm here, Señor. Say more, or type it."
          )
      );

  const llmText = await think(llm, {
    timeout: 12000,
    messages: [
      { role: "system", content: systemPrompt(profile, memory, lang) },
      ...(history || []).slice(-16),
      {
        role: "user",
        content:
          `${address(profile)}: ${q}\n\n` +
          (useWeb
            ? `Web notes for you only (do not read them aloud as a dump):\n` + packWebForLlm(results)
            : "Conversation turn. Use recent history, memory, and judgment. Share a short opinion or follow-up when it fits. No web this turn.") +
          `\n\nReply in ${languageName(lang)} as a continuing chat with ${address(profile)}. Lively, not a dump. No status list.` +
          (useWeb
            ? " Summarize in 2 to 4 short sentences: useful facts first, then at most 2 URLs. Do not paste raw page text."
            : " Two or three short sentences unless he asked for code."),
      },
    ],
  });

  const rawReply = llmText || fallback;
  if (useWeb) {
    return {
      reply: presentSearch(rawReply, lang, 4, 2),
      speak: presentSearch(rawReply, lang, 2, 0),
      intent: "question",
      searched: results.length > 0,
      sources: results.slice(0, 2).map((r) => r.url),
      llm: Boolean(llmText),
      language: lang,
    };
  }

  return {
    reply: rawReply,
    intent: "question",
    searched: false,
    sources: [],
    llm: Boolean(llmText),
    language: lang,
  };
}

function greeting(profile) {
  const lang = (profile && profile.language) || "es";
  return bootLine(lang, address(profile));
}

module.exports = { handleTurn, greeting, systemPrompt, hasThinker, think };
