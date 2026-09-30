const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { kindOf, copyIntoUploads, readTextSnippet, safeName } = require("./attach");
const { createSight } = require("./sight");
const { detectIntent } = require("./intents");
const { handleTurn } = require("./brain");
const { loadProfile } = require("./profile");
const { createMemory } = require("./memory");

assert.strictEqual(kindOf("foto.PNG"), "image");
assert.strictEqual(kindOf("nota.md"), "text");
assert.strictEqual(kindOf("doc.pdf"), "file");
assert.strictEqual(safeName("hi/../x.png"), "hi_.._x.png");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-att-"));
const src = path.join(dir, "hola.txt");
fs.writeFileSync(src, "Rabbit dice hola desde un adjunto.");
const dest = copyIntoUploads(dir, src);
assert.ok(fs.existsSync(dest));
assert.match(readTextSnippet(dest), /Rabbit/);

const sight = createSight({
  dir,
  captureFn: async () => {
    throw new Error("no-screen");
  },
  llm: { apiKey: "", baseUrl: "", model: "" },
});
const ingested = sight.ingestPath(src, "hola.txt");
assert.strictEqual(ingested.kind, "text");
assert.strictEqual(sight.has(), true);

(async () => {
  const looked = await sight.lookAttached("mira esto");
  assert.match(looked, /hola.txt|Rabbit/i);

  const profile = loadProfile(dir);
  const memory = createMemory(path.join(dir, "memory.json"));
  const turn = await handleTurn({
    text: "mira esto",
    history: [],
    profile,
    llm: { apiKey: "", baseUrl: "", model: "" },
    memory,
    sight,
    useAttach: true,
  });
  assert.strictEqual(turn.intent, "look_attach");
  assert.match(turn.reply, /Rabbit|hola/i);
  assert.strictEqual(detectIntent("mira esto").type, "look_attach");
  console.log("attach ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
