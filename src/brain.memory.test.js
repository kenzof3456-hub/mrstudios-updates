const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { createMemory } = require("./memory");
const { handleTurn } = require("./brain");
const { loadProfile } = require("./profile");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-brain-"));
const memory = createMemory(path.join(dir, "memory.json"));
const profile = loadProfile(dir);
const llm = { apiKey: "", baseUrl: "", model: "" };

(async () => {
  const a = await handleTurn({
    text: "recuerda que uso Discord por las tardes",
    history: [],
    profile,
    llm,
    memory,
  });
  assert.strictEqual(a.intent, "remember");
  assert.match(a.reply, /Apuntado/);
  assert.match(a.reply, /\n/);

  const b = await handleTurn({
    text: "qué sabes de mí",
    history: [],
    profile,
    llm,
    memory,
  });
  assert.strictEqual(b.intent, "recall");
  assert.match(b.reply, /Discord/);

  const c = await handleTurn({
    text: "olvida Discord",
    history: [],
    profile,
    llm,
    memory,
  });
  assert.strictEqual(c.intent, "forget");
  assert.strictEqual(memory.list().length, 0);
  console.log("brain memory ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
