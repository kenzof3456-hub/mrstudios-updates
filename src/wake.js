const { normalize } = require("./intents");

function parseWake(raw) {
  const original = String(raw || "").trim();
  if (!original) return { woke: false, rest: "" };
  const re =
    /^(?:oye |hey |ok |okay |eh |buenas |hola )*(jarvis)\b[\s,.:\-!]*(.*)$/i;
  const m = original.match(re);
  if (!m) {
    const t = normalize(original);
    if (/\bjarvis\b/.test(t) && t.startsWith("jarvis")) {
      return { woke: true, rest: original.replace(/^jarvis\b[\s,.:\-!]*/i, "").trim() };
    }
    return { woke: false, rest: original };
  }
  return { woke: true, rest: String(m[2] || "").trim() };
}

module.exports = { parseWake };
