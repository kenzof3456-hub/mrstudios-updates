const assert = require("assert");
const { JARVIS_TTS, rankBrowserVoice, CLIP } = require("./jarvis-voice");

assert.strictEqual(JARVIS_TTS.openaiVoice, "fable");
assert.strictEqual(JARVIS_TTS.edgeVoices[0], "es-ES-AlvaroNeural");
assert.ok(JARVIS_TTS.edgeVoices.includes("en-GB-RyanNeural"));
assert.match(CLIP.title, /Jarvis/i);
assert.match(CLIP.note, /not a license to clone/i);

const picked = rankBrowserVoice([
  { name: "Microsoft Helena", lang: "es-ES" },
  { name: "Microsoft George", lang: "en-GB" },
  { name: "Google español", lang: "es-MX" },
]);
assert.strictEqual(picked.name, "Microsoft George");

console.log("jarvis-voice ok");
