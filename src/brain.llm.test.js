const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { handleTurn, systemPrompt } = require("./brain");
const { createMemory } = require("./memory");
const { loadProfile } = require("./profile");
const { formatSearchAnswer } = require("./search");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-llm-"));
const memory = createMemory(path.join(dir, "memory.json"));
const profile = loadProfile(dir);
const craftDir = path.join(dir, "craft");

const combined = formatSearchAnswer(
  "neutrinos",
  [
    { title: "A", snippet: "Neutrinos barely interact with matter. They stream from the sun in huge numbers.", url: "https://a.example/" },
    { title: "B", snippet: "Detectors use tanks of water or ice to catch a rare flash.", url: "https://b.example/" },
  ],
  "en"
);
assert.match(combined, /Neutrinos/);
assert.match(combined, /Sources:/);
assert.ok(combined.split("\n").join(" ").length > 80);

assert.match(systemPrompt(profile, memory, "es"), /Think, then act/);

(async () => {
  const llm = {
    apiKey: "test",
    chat: async ({ json }) => {
      if (json) {
        return JSON.stringify({ action: "craft", query: "bot de Discord", need_web: false });
      }
      return "FILE: ping.js\n```javascript\nconsole.log(1)\n```";
    },
  };
  const made = await handleTurn({
    text: "hazme un bot de Discord",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(made.intent, "craft");
  assert.ok(made.saved && made.saved[0]);
  assert.ok(fs.existsSync(made.saved[0]));

  const hi = await handleTurn({
    text: "hola",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(hi.reply, "Hola, Señor.");

  const talker = {
    apiKey: "test",
    chat: async ({ json }) => {
      if (json) return JSON.stringify({ action: "profile", query: "", need_web: false });
      return "Eres Luis. Te llamo Señor, y no recito un parte de sistema.";
    },
  };
  const who = await handleTurn({
    text: "quién soy",
    history: [],
    profile,
    llm: talker,
    memory,
    craftDir,
  });
  assert.strictEqual(who.intent, "profile");
  assert.match(who.reply, /Señor/);
  assert.doesNotMatch(who.reply, /Adjuntar|UTC/);

  await handleTurn({
    text: "recuerda que me gusta el café",
    history: [],
    profile,
    llm: { apiKey: "" },
    memory,
    craftDir,
  });
  const fromMem = {
    apiKey: "test",
    chat: async ({ json }) => {
      if (json) return JSON.stringify({ action: "answer", query: "café", need_web: false });
      return "Te gusta el café, Señor. Lo tengo en la libreta.";
    },
  };
  const likes = await handleTurn({
    text: "qué me gusta",
    history: [],
    profile,
    llm: fromMem,
    memory,
    craftDir,
  });
  assert.strictEqual(likes.intent, "question");
  assert.strictEqual(likes.searched, false);
  assert.match(likes.reply, /café|Señor/i);

  const chatter = {
    apiKey: "test",
    chat: async ({ json, messages }) => {
      if (json) return JSON.stringify({ action: "chat", query: "y eso qué opinas", need_web: false });
      const blob = JSON.stringify(messages);
      assert.match(blob, /peli/);
      assert.match(blob, /opinas/);
      return "Si te enganchó, Señor, merece una segunda. ¿De qué iba?";
    },
  };
  const chat = await handleTurn({
    text: "y eso qué opinas",
    history: [
      { role: "user", content: "ayer vi una peli rara" },
      { role: "assistant", content: "¿Cuál, Señor?" },
    ],
    profile,
    llm: chatter,
    memory,
    craftDir,
  });
  assert.strictEqual(chat.intent, "question");
  assert.strictEqual(chat.searched, false);
  assert.match(chat.reply, /Señor/);

  console.log("brain llm ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
