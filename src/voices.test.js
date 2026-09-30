const assert = require("assert");
const { resolveVoice, parseVoiceCommand, celebrityQuery } = require("./voices");

assert.strictEqual(parseVoiceCommand("habla con voz de Jorge").type, "set_voice");
assert.match(parseVoiceCommand("habla con voz de Jorge").query, /Jorge/i);
assert.strictEqual(parseVoiceCommand("cambia la voz a Nova").type, "set_voice");
assert.strictEqual(parseVoiceCommand("lista las voces").type, "list_voices");
assert.strictEqual(parseVoiceCommand("qué hora es"), null);

const jorge = resolveVoice("Jorge");
assert.equal(jorge.ok, true);
assert.equal(jorge.voice.id, "es-MX-JorgeNeural");

const def = resolveVoice("jarvis");
assert.equal(def.voice.id, "es-ES-AlvaroNeural");

assert.equal(celebrityQuery("paul bettany"), true);
assert.equal(resolveVoice("paul bettany").celebrity, true);

assert.equal(resolveVoice("xyzzy-not-a-voice").ok, false);
console.log("voices ok");
