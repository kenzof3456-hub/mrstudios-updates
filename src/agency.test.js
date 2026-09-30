const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const {
  peelDoIt,
  isWipe,
  isDestructive,
  clearPendingDanger,
  executeLast,
} = require("./agency");
const { detectIntent } = require("./intents");
const { handleTurn } = require("./brain");
const { createMemory } = require("./memory");
const { loadProfile } = require("./profile");
const { setLastFiles } = require("./craft");

clearPendingDanger();

assert.strictEqual(peelDoIt("házmelo").bare, true);
assert.strictEqual(peelDoIt("hazme esto").bare, true);
assert.strictEqual(peelDoIt("do this").bare, true);
assert.strictEqual(peelDoIt("hazme un bot de Discord").execute, true);
assert.match(peelDoIt("hazme un bot de Discord").rest, /bot de Discord/i);
assert.strictEqual(peelDoIt("qué hora es").execute, false);
assert.strictEqual(isWipe("formatea el disco"), true);
assert.strictEqual(isWipe("escribe un bot"), false);
assert.strictEqual(isDestructive("borra el archivo foo.js"), true);

assert.strictEqual(detectIntent("házmelo").type, "do_last");
assert.strictEqual(detectIntent("hazme abrir chrome").type, "open_app");
assert.strictEqual(detectIntent("hazme abrir chrome").app.includes("chrome"), true);
assert.strictEqual(detectIntent("formatea el disco").type, "agency_refuse");

const ask = detectIntent("borra el archivo discord_bot.js");
assert.strictEqual(ask.type, "agency_ask");
const yes = detectIntent("sí");
assert.strictEqual(yes.type, "delete_file");
assert.ok(yes.confirmed);
clearPendingDanger();

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-agency-"));
  const memory = createMemory(path.join(tmp, "memory.json"));
  const profile = loadProfile(tmp);
  const llm = { apiKey: "", baseUrl: "", model: "" };
  const craftDir = path.join(tmp, "craft");
  const made = await handleTurn({
    text: "hazme un bot de Discord",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(made.intent, "craft");
  assert.ok(made.saved[0]);
  assert.ok(fs.existsSync(made.saved[0]));

  const again = await handleTurn({
    text: "házmelo",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(again.intent, "do_last");
  assert.match(again.reply, /Hecho|disco|Wrote|Already/i);

  const wipe = await handleTurn({
    text: "formatea el disco",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(wipe.intent, "agency_refuse");

  const delAsk = await handleTurn({
    text: "borra el archivo discord_bot.js",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(delAsk.intent, "agency_ask");
  const del = await handleTurn({
    text: "sí",
    history: [],
    profile,
    llm,
    memory,
    craftDir,
  });
  assert.strictEqual(del.intent, "delete_file");
  assert.ok(!fs.existsSync(path.join(craftDir, "discord_bot.js")));

  setLastFiles([{ name: "ping.js", language: "js", content: "console.log(1)\n" }]);
  const last = await executeLast(craftDir, "es");
  assert.ok(fs.existsSync(last.saved[0]));
  clearPendingDanger();
  console.log("agency ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
