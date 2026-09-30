/** Written voice for v1. Later TTS should follow this: lively, emotional, not flat. */

function say(...parts) {
  return parts
    .flat()
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join("\n");
}

function aside(memory, text, lang) {
  if (!memory || !memory.relatedTo) return "";
  const rel = memory.relatedTo(text).slice(0, 2);
  if (!rel.length) return "";
  const bits = rel.map((f) => f.text).join("; ");
  return lang === "en"
    ? `I remember: ${bits}.`
    : `Me acordé: ${bits}.`;
}

module.exports = { say, aside };
