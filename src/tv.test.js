const assert = require("assert");
const {
  looksLikeTv,
  isTvPiracy,
  parseCountry,
  isCastAsk,
  pirateTvReply,
  formatListings,
} = require("./tv");
const { detectIntent } = require("./intents");

assert.strictEqual(looksLikeTv("qué echan en Japón"), true);
assert.strictEqual(looksLikeTv("what's on TV in Japan"), true);
assert.strictEqual(looksLikeTv("reparto de The Office"), true);
assert.strictEqual(looksLikeTv("qué hora es"), false);
assert.strictEqual(isTvPiracy("pásame cuevana del capítulo"), true);
assert.strictEqual(isTvPiracy("qué echan en México"), false);
assert.strictEqual(parseCountry("qué echan en Japón", "es").code, "JP");
assert.strictEqual(parseCountry("what's on TV in the UK", "en").code, "GB");
assert.strictEqual(parseCountry("qué echan en Tailandia", "es").code, "TH");
assert.strictEqual(parseCountry("what's on TV in Iceland", "en").code, "IS");
assert.match(parseCountry("qué echan en Kenia", "es").name.en, /kenia/i);
assert.strictEqual(parseCountry("qué echan hoy", "es").code, "MX");
assert.strictEqual(detectIntent("qué echan en Kenia").type, "tv");
assert.strictEqual(isCastAsk("reparto de dark"), true);
assert.match(pirateTvReply("es"), /rips|pirata/i);
assert.strictEqual(detectIntent("qué echan en Japón").type, "tv");
assert.strictEqual(detectIntent("abre netflix").type, "open_app");
assert.strictEqual(detectIntent("escribe un programa en python").type, "craft");

const block = formatListings(
  [{ time: "21:00", channel: "NHK", title: "News" }],
  { tz: "Asia/Tokyo", name: { es: "Japón", en: "Japan" } },
  "es"
);
assert.match(block, /NHK/);
assert.match(block, /Asia\/Tokyo/);
console.log("tv ok");
