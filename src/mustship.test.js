const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DEFAULT_PROFILE } = require("./profile");
const { peelDoIt } = require("./agency");
const { looksLikeCraft } = require("./craft");
const { looksLikeFaceAsk } = require("./faces");
const { detectIntent } = require("./intents");
const { systemPrompt } = require("./brain");
const { catalog } = require("./voices");
const { detectLanguage } = require("./lang");
const { GREETINGS } = require("./spoken");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "renderer", "index.html"), "utf8");
const orb = fs.readFileSync(path.join(root, "renderer", "orb.js"), "utf8");
const app = fs.readFileSync(path.join(root, "renderer", "app.js"), "utf8");

assert.strictEqual(DEFAULT_PROFILE.nickname, "Señor");
assert.strictEqual(detectIntent("hola").type, "hello");
assert.strictEqual(detectIntent("hello").type, "hello");
assert.strictEqual(detectIntent("hola Jarvis").type, "hello");
assert.strictEqual(detectIntent("Jarvis hola").type, "hello");
assert.doesNotMatch(GREETINGS.es.join(" "), /Rabbit/);
assert.match(app, /SEÑOR/);
assert.strictEqual(peelDoIt("hazme esto").bare, true);
assert.strictEqual(detectIntent("házmelo").type, "do_last");
const prompt = systemPrompt(
  { realName: "Luis", nickname: "Señor", os: "Windows", language: "es" },
  { contextBlock: () => "" },
  "es"
);
assert.match(prompt, /Señor/);
assert.match(prompt, /Think, then act/);
assert.doesNotMatch(prompt, /Rabbit/);

assert.match(html, /id="orb"/);
assert.match(html, /id="attach"/);
assert.match(html, />Adjuntar</);
assert.match(orb, /ellipse/);
assert.match(orb, /dir: 1/);
assert.match(orb, /dir: -1/);
assert.match(orb, /state === "speak"/);
assert.match(orb, /rotSpeed = 0\.16/);
assert.match(orb, /drawOrganicRing/);
assert.match(orb, /freqTarget/);
assert.match(orb, /getByteFrequencyData|born/);
assert.doesNotMatch(orb, /k < 6/);
assert.doesNotMatch(orb, /rgba\(255,\s*1[89]\d,\s*\d+/);

assert.match(html, /id="voice-pick"/);
assert.ok(catalog([]).length > 12);
assert.strictEqual(detectLanguage("what time is it"), "en");
assert.strictEqual(detectLanguage("qué hora es"), "es");

assert.strictEqual(looksLikeCraft("hazme un addon de blender"), true);
assert.strictEqual(detectIntent("escribe un bot de Discord").type, "craft");

assert.strictEqual(looksLikeFaceAsk("quién es esta persona"), true);
assert.match(html, /házmelo/);
assert.match(html, /quién es esta persona/);
assert.match(html, /manda un mensaje/);

assert.match(html, /qué echan en Japón/);
assert.strictEqual(detectIntent("qué echan en Japón").type, "tv");

console.log("mustship ok");
