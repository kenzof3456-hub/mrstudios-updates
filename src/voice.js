/** Written voice for v1. Later TTS should follow this: lively, emotional, not flat. */

function say(...parts) {
  return parts
    .flat()
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join("\n");
}

function aside(memory, text) {
  if (!memory || !memory.relatedTo) return "";
  const rel = memory.relatedTo(text).slice(0, 2);
  if (!rel.length) return "";
  return `¡Espera! Me acordé: ${rel.map((f) => f.text).join("; ")}.`;
}

module.exports = { say, aside };
