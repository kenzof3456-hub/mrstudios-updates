const { normalize } = require("./intents");

const FILLER =
  /\b(oye|hey|ok|okay|eh|buenas|hola|rabbit|a ver|porfa|por favor)\b/g;

function parseWake(raw) {
  const original = String(raw || "").trim();
  if (!original) return { woke: false, rest: "" };
  const t = normalize(original);
  const idx = t.search(/\bjarvis\b/);
  if (idx === -1) return { woke: false, rest: original };
  const before = t.slice(0, idx).replace(FILLER, "").replace(/[\s,.:\-!¿?]+/g, "");
  if (before.length > 0) return { woke: false, rest: original };
  const rest = original.replace(/^[\s\S]*?\bjarvis\b[\s,.:\-!]*/i, "").trim();
  return { woke: true, rest };
}

module.exports = { parseWake };
