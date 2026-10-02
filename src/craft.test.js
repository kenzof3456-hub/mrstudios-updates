const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const {
  looksLikeCraft,
  looksLikeSaveCode,
  isPiracy,
  extractFiles,
  localFallback,
  writeCraftFile,
} = require("./craft");
const { detectIntent } = require("./intents");

assert.strictEqual(looksLikeCraft("escribe un bot de Discord"), true);
assert.strictEqual(looksLikeCraft("hazme un addon de blender"), true);
assert.strictEqual(looksLikeCraft("qué es un agujero negro"), false);
assert.strictEqual(looksLikeSaveCode("guarda el codigo"), true);
assert.strictEqual(looksLikeSaveCode("guarda que uso Discord"), false);
assert.strictEqual(isPiracy("crackea este plugin de pago"), true);
assert.strictEqual(isPiracy("escribe un bot de Discord"), false);
assert.strictEqual(detectIntent("abre chrome").type, "open_app");
assert.strictEqual(detectIntent("recuerda que uso Discord por las tardes").type, "remember");
assert.strictEqual(detectIntent("escribe un bot de Discord en javascript").type, "craft");
assert.strictEqual(detectIntent("escribe un bot de Discord").type, "craft");
assert.strictEqual(detectIntent("guarda el codigo").type, "save_code");

const md = "FILE: hello.py\n```python\nprint(1)\n```";
const files = extractFiles(md, "python");
assert.strictEqual(files[0].name, "hello.py");
assert.match(files[0].content, /print/);

const local = localFallback("script de blender cubo", "es");
assert.match(local.reply, /bpy/);
const disc = localFallback("escribe un bot de Discord", "es");
assert.match(disc.reply, /discord\.js/);
const fivem = localFallback("script de fivem ping", "es");
assert.match(fivem.reply, /CreateThread/);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-craft-"));
const dest = writeCraftFile(dir, local.files[0]);
assert.ok(fs.existsSync(dest));

const { handleTurn } = require("./brain");
const { createMemory } = require("./memory");
const { loadProfile } = require("./profile");

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-craft-turn-"));
  const memory = createMemory(path.join(tmp, "memory.json"));
  const profile = loadProfile(tmp);
  const llm = { apiKey: "", baseUrl: "", model: "" };
  const craftDir = path.join(tmp, "craft");
  const made = await handleTurn({
    text: "escribe un bot de Discord",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(made.intent, "craft");
  assert.match(made.reply, /discord\.js/);
  assert.ok(made.files.length);
  assert.ok(made.saved && made.saved[0]);
  assert.ok(fs.existsSync(made.saved[0]));

  const saved = await handleTurn({
    text: "guarda el codigo",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(saved.intent, "save_code");
  assert.ok(saved.saved[0]);
  assert.ok(fs.existsSync(saved.saved[0]));

  const pirate = await handleTurn({
    text: "crackea este plugin de pago de minecraft",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(pirate.intent, "craft");
  assert.match(pirate.reply, /pirateo|won't pirate/i);

  const remember = await handleTurn({
    text: "recuerda que uso Discord por las tardes",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(remember.intent, "remember");
  console.log("craft ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
