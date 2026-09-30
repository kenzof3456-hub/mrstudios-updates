const assert = require("assert");
const {
  looksLikeFaceAsk,
  parseFaceVision,
  sanitizeIdentity,
  publicSearchQuery,
  formatFaceAnswer,
} = require("./faces");
const { detectIntent } = require("./intents");

assert.strictEqual(looksLikeFaceAsk("quién es esta persona"), true);
assert.strictEqual(looksLikeFaceAsk("who is this person"), true);
assert.strictEqual(looksLikeFaceAsk("qué hora es"), false);
assert.strictEqual(detectIntent("quién es esta persona").type, "screen_ask");

const known = parseFaceVision(
  "Un actor en un estreno.\nFACES: 1\nID: Keanu Reeves\nBUSCAR: Keanu Reeves actor"
);
assert.strictEqual(known.count, 1);
assert.strictEqual(known.unknown, false);
assert.match(publicSearchQuery(known), /Keanu/);

const unk = parseFaceVision("Rostro borroso.\nFACES: 1\nID: UNKNOWN\nBUSCAR: UNKNOWN");
assert.strictEqual(unk.unknown, true);
assert.strictEqual(publicSearchQuery(unk), "");

const dirty =
  "ID: UNKNOWN\nCall 555-123-4567 or jane@mail.com at 12 Oak Street.";
assert.match(sanitizeIdentity(dirty), /\[redacted\]/);
assert.doesNotMatch(sanitizeIdentity(dirty), /555-123/);
assert.doesNotMatch(sanitizeIdentity(dirty), /jane@/);

const ans = formatFaceAnswer("es", unk, "");
assert.match(ans, /No invento/);
assert.match(ans, /Señor|imagen/);
assert.match(ans, /webcam|álbum/i);
const { createSight } = require("./sight");
const os = require("os");
const path = require("path");
const fs = require("fs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-face-"));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
fs.writeFileSync(path.join(dir, "dot.png"), png);
const sight = createSight({
  dir,
  captureFn: async () => {
    throw new Error("no-screen");
  },
  llm: { apiKey: "", baseUrl: "", model: "" },
});
sight.ingestPath(path.join(dir, "dot.png"), "dot.png");

(async () => {
  const looked = await sight.lookAttached("quién es esta persona", "es");
  assert.match(looked, /invento|visión|Señor/i);
  assert.doesNotMatch(looked, /555-/);
  console.log("faces ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
