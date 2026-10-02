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
const speak = fs.readFileSync(path.join(root, "renderer", "speak.js"), "utf8");
const tts = fs.readFileSync(path.join(root, "src", "tts.js"), "utf8");
const planSrc = fs.readFileSync(path.join(root, "src", "plan.js"), "utf8");
const searchSrc = fs.readFileSync(path.join(root, "src", "search.js"), "utf8");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");

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
assert.match(prompt, /Chat is the default/);
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

assert.match(html, /id="jarvis-voice"/);
assert.match(speak, /unlockAudio/);
assert.match(speak, /volume = 1/);
assert.match(app, /HABLANDO/);
assert.match(app, /no pude hablar/);
assert.match(app, /onUserUnlock/);
assert.match(app, /enableEar/);
assert.match(app, /getUserMedia/);
assert.match(app, /mic-hint/);
assert.match(html, /id="mic-hint"/);
assert.match(html, /Reintentar micrófono/);
assert.match(app, /voiceMode === "always"/);
assert.match(main, /setDevicePermissionHandler/);
assert.match(tts, /\$s\.Volume = 100/);
assert.match(main, /autoplay-policy/);
assert.match(prompt, /search the web thoroughly/);
assert.match(planSrc, /Chat is the default/);
assert.match(planSrc, /need_web true for unknown facts/);
assert.match(searchSrc, /packWebForLlm/);
assert.match(searchSrc, /topicQuery/);
assert.match(searchSrc, /wikiSearch|wikipedia/);
assert.match(app, /enqueueSend/);
assert.match(app, /PENSANDO/);
assert.doesNotMatch(app, /sendBtn\.disabled = true/);
assert.match(main, /jarvis:transcribe/);
assert.match(main, /uncaughtException/);
assert.match(fs.readFileSync(path.join(root, "renderer", "listen.js"), "utf8"), /whisperLoop|transcribeBlob/);

console.log("mustship ok");
