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
console.log("craft ok");
