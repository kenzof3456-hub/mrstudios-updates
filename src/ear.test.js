const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { detectIntent, isJunkStt, looksLikeHearing } = require("./intents");
const { capSpoken, isEcho, isStatusDump, bootLine } = require("./spoken");
const { greeting, handleTurn, systemPrompt } = require("./brain");
const { createMemory } = require("./memory");
const { loadProfile } = require("./profile");
const { whisperLow } = require("./stt");

assert.strictEqual(looksLikeHearing("me escuchas"), true);
assert.strictEqual(looksLikeHearing("¿me oyes?"), true);
assert.strictEqual(looksLikeHearing("estás ahí"), true);
assert.strictEqual(looksLikeHearing("Jarvis, me estás escuchando"), true);
assert.strictEqual(detectIntent("me escuchas").type, "hearing");
assert.strictEqual(detectIntent("qué es honda").type, "question");

assert.strictEqual(isJunkStt("a"), true);
assert.strictEqual(isJunkStt("k"), true);
assert.strictEqual(isJunkStt("a b c"), true);
assert.strictEqual(isJunkStt("la letra m"), true);
assert.strictEqual(isJunkStt("abecedario"), true);
assert.strictEqual(isJunkStt("qué es honda"), false);
assert.strictEqual(isJunkStt("me escuchas"), false);
assert.strictEqual(isJunkStt("qué opinas de esa peli"), false);

assert.strictEqual(isEcho("Sí, Señor, te escucho.", "Sí, Señor, te escucho."), true);
assert.strictEqual(isEcho("jarvis", "En línea, Señor."), false);
assert.strictEqual(isEcho("qué hora es", "En línea, Señor."), false);

const long =
  "Primera frase del resumen. Segunda frase con el dato. Tercera frase de cierre. Cuarta que no se dice.";
assert.strictEqual(
  capSpoken(long),
  "Primera frase del resumen. Segunda frase con el dato. Tercera frase de cierre."
);
assert.strictEqual(
  capSpoken(long, { search: true }),
  "Primera frase del resumen. Segunda frase con el dato."
);
const codeTalk =
  "Te dejo el bot, Señor. Abre Discord y pega el token. Revisa el permiso de mensajes. El archivo ya está en disco. Hay un quinto detalle en el chat.";
assert.ok(capSpoken(codeTalk, { code: true }).split(".").length > 4);

const dump =
  "En línea, Señor. viernes, 2 de octubre (America/Mexico_City). Adjuntar, mensajes, voces. 3 notas guardadas.";
assert.strictEqual(isStatusDump(dump), true);
assert.strictEqual(capSpoken(dump), "En línea, Señor.");
assert.strictEqual(bootLine("es", "Señor"), "En línea, Señor.");

const profile = loadProfile(fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-ear-")));
const hi = greeting(profile, { list: () => [{ text: "nota" }] });
assert.strictEqual(hi, "En línea, Señor.");
assert.doesNotMatch(hi, /Adjuntar|notas guardadas|America\//);

const prompt = systemPrompt(profile, { contextBlock: () => "" }, "es");
assert.match(prompt, /Chat is the default/);
assert.match(prompt, /Express yourself/);
assert.match(prompt, /search the web thoroughly/);
assert.match(prompt, /at most 2 source links/);
assert.match(prompt, /Señor/);

assert.strictEqual(
  whisperLow({ segments: [{ avg_logprob: -1.4, no_speech_prob: 0.1 }] }),
  true
);
assert.strictEqual(
  whisperLow({ segments: [{ avg_logprob: -0.2, no_speech_prob: 0.05 }] }),
  false
);

const app = fs.readFileSync(path.join(__dirname, "..", "renderer", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "renderer", "index.html"), "utf8");
const listen = fs.readFileSync(path.join(__dirname, "..", "renderer", "listen.js"), "utf8");
assert.match(app, /EAR_RESUME_MS = 400/);
assert.match(app, /__jarvisMuteEar/);
assert.match(app, /needWake/);
assert.match(html, /Micrófono/);
assert.match(html, /id="mic-pick"/);
assert.match(html, /id="gear"/);
assert.match(html, /id="api-key"/);
assert.match(listen, /deviceId/);
assert.match(listen, /__jarvisMicId/);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-ear-turn-"));
  const memory = createMemory(path.join(dir, "memory.json"));
  const who = loadProfile(dir);
  const boom = {
    apiKey: "test",
    chat: async () => {
      throw new Error("should-not-search");
    },
  };
  const hear = await handleTurn({
    text: "me escuchas",
    history: [{ role: "user", content: "ayer vimos una peli" }],
    profile: who,
    llm: boom,
    memory,
  });
  assert.strictEqual(hear.reply, "Sí, Señor, te escucho.");
  assert.strictEqual(hear.speak, "Sí, Señor, te escucho.");
  assert.strictEqual(hear.searched, false);

  for (const phrase of ["me oyes", "estás ahí", "k", "a b c", "abecedario"]) {
    const turn = await handleTurn({
      text: phrase,
      history: [],
      profile: who,
      llm: boom,
      memory,
    });
    assert.notStrictEqual(turn.intent, "question");
    assert.strictEqual(turn.searched, false);
    if (phrase === "k" || phrase === "a b c" || phrase === "abecedario") {
      assert.match(turn.reply, /repetir/);
    } else {
      assert.strictEqual(turn.reply, "Sí, Señor, te escucho.");
    }
  }

  const low = await handleTurn({
    text: "qué es honda",
    history: [],
    profile: who,
    llm: boom,
    memory,
    lowConfidence: true,
  });
  assert.match(low.reply, /repetir/);
  assert.strictEqual(low.searched, false);

  const chatty = {
    apiKey: "test",
    chat: async ({ json, messages }) => {
      if (json) return JSON.stringify({ action: "chat", query: "y tú qué opinas", need_web: false });
      const blob = JSON.stringify(messages);
      assert.match(blob, /peli/);
      return "Opino que merece otra vista, Señor. ¿Te enganchó el final?";
    },
  };
  const opinion = await handleTurn({
    text: "y tú qué opinas",
    history: [
      { role: "user", content: "ayer vi una peli rara" },
      { role: "assistant", content: "Cuéntame, Señor." },
    ],
    profile: who,
    llm: chatty,
    memory,
  });
  assert.strictEqual(opinion.searched, false);
  assert.match(opinion.reply, /Señor/);
  assert.match(opinion.speak, /Señor/);
  assert.ok(opinion.speak.split(/[.!?]/).filter((s) => s.trim()).length <= 3);

  console.log("ear ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
