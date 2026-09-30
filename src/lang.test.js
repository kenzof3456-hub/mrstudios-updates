const assert = require("assert");
const { detectLanguage, ttsVoiceFor, localeFor } = require("./lang");

assert.strictEqual(detectLanguage("qué hora es"), "es");
assert.strictEqual(detectLanguage("what time is it"), "en");
assert.strictEqual(detectLanguage("bonjour comment allez vous merci"), "fr");
assert.strictEqual(detectLanguage(""), "es");
assert.strictEqual(detectLanguage("hello"), "en");
assert.strictEqual(detectLanguage("hola"), "es");
assert.strictEqual(detectLanguage("hi"), "en");
assert.strictEqual(localeFor("en"), "en-GB");

const v = ttsVoiceFor({
  language: "en",
  voice: { engine: "edge", id: "es-ES-AlvaroNeural", lang: "es-ES", gender: "male" },
});
assert.strictEqual(v.id, "en-GB-RyanNeural");

const keep = ttsVoiceFor({
  language: "es",
  voice: { engine: "edge", id: "es-ES-AlvaroNeural", lang: "es-ES", gender: "male" },
});
assert.strictEqual(keep.id, "es-ES-AlvaroNeural");

console.log("lang ok");
