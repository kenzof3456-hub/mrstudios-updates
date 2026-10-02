const { JARVIS_TTS } = require("./jarvis-voice");

function nrm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const OPENAI_VOICES = [
  { id: "alloy", label: "Alloy", gender: "neutral" },
  { id: "ash", label: "Ash", gender: "male" },
  { id: "coral", label: "Coral", gender: "female" },
  { id: "echo", label: "Echo", gender: "male" },
  { id: "fable", label: "Fable (UK)", gender: "male" },
  { id: "onyx", label: "Onyx", gender: "male" },
  { id: "nova", label: "Nova", gender: "female" },
  { id: "sage", label: "Sage", gender: "female" },
  { id: "shimmer", label: "Shimmer", gender: "female" },
].map((v) => ({ ...v, engine: "openai", lang: "multi" }));

const EDGE_VOICES = [
  { id: "es-ES-AlvaroNeural", label: "Álvaro", lang: "es-ES", gender: "male" },
  { id: "es-ES-ElviraNeural", label: "Elvira", lang: "es-ES", gender: "female" },
  { id: "es-MX-JorgeNeural", label: "Jorge", lang: "es-MX", gender: "male" },
  { id: "es-MX-DaliaNeural", label: "Dalia", lang: "es-MX", gender: "female" },
  { id: "es-AR-TomasNeural", label: "Tomás", lang: "es-AR", gender: "male" },
  { id: "es-AR-ElenaNeural", label: "Elena", lang: "es-AR", gender: "female" },
  { id: "en-GB-RyanNeural", label: "Ryan", lang: "en-GB", gender: "male" },
  { id: "en-GB-SoniaNeural", label: "Sonia", lang: "en-GB", gender: "female" },
  { id: "en-GB-ThomasNeural", label: "Thomas", lang: "en-GB", gender: "male" },
  { id: "en-US-GuyNeural", label: "Guy", lang: "en-US", gender: "male" },
  { id: "en-US-JennyNeural", label: "Jenny", lang: "en-US", gender: "female" },
  { id: "en-US-AriaNeural", label: "Aria", lang: "en-US", gender: "female" },
  { id: "en-US-DavisNeural", label: "Davis", lang: "en-US", gender: "male" },
  { id: "fr-FR-HenriNeural", label: "Henri", lang: "fr-FR", gender: "male" },
  { id: "fr-FR-DeniseNeural", label: "Denise", lang: "fr-FR", gender: "female" },
  { id: "de-DE-ConradNeural", label: "Conrad", lang: "de-DE", gender: "male" },
  { id: "de-DE-KatjaNeural", label: "Katja", lang: "de-DE", gender: "female" },
  { id: "it-IT-DiegoNeural", label: "Diego", lang: "it-IT", gender: "male" },
  { id: "it-IT-ElsaNeural", label: "Elsa", lang: "it-IT", gender: "female" },
  { id: "pt-BR-AntonioNeural", label: "Antônio", lang: "pt-BR", gender: "male" },
  { id: "pt-BR-FranciscaNeural", label: "Francisca", lang: "pt-BR", gender: "female" },
  { id: "ja-JP-KeitaNeural", label: "Keita", lang: "ja-JP", gender: "male" },
  { id: "ja-JP-NanamiNeural", label: "Nanami", lang: "ja-JP", gender: "female" },
  { id: "zh-CN-YunxiNeural", label: "Yunxi", lang: "zh-CN", gender: "male" },
  { id: "zh-CN-XiaoxiaoNeural", label: "Xiaoxiao", lang: "zh-CN", gender: "female" },
  { id: "ko-KR-InJoonNeural", label: "InJoon", lang: "ko-KR", gender: "male" },
  { id: "ko-KR-SunHiNeural", label: "SunHi", lang: "ko-KR", gender: "female" },
].map((v) => ({ ...v, engine: "edge" }));

const CELEBRITY =
  /\b(paul bettany|bettany|rdj|robert downey|downey jr|iron man actor|shakira|pique|messi|bad bunny|shakira|beyonce|taylor swift|obama|trump|milei|pablo milanes|juan gabriel)\b/i;

function defaultVoiceChoice() {
  return {
    engine: "edge",
    id: JARVIS_TTS.edgeVoices[0],
    label: "Álvaro · es-ES",
    lang: "es-ES",
    gender: "male",
  };
}

function catalog(extra) {
  const extras = Array.isArray(extra) ? extra : [];
  return [...EDGE_VOICES, ...OPENAI_VOICES, ...extras];
}

function celebrityQuery(query) {
  return CELEBRITY.test(nrm(query));
}

function scoreVoice(v, q) {
  const blob = nrm(`${v.id} ${v.label} ${v.lang} ${v.engine} ${v.gender}`);
  if (!q) return 0;
  if (blob === q || nrm(v.id) === q || nrm(v.label) === q) return 100;
  if (blob.includes(q)) return 80;
  const parts = q.split(/\s+/).filter((w) => w.length > 2);
  let s = 0;
  for (const p of parts) if (blob.includes(p)) s += 20;
  return s;
}

function resolveVoice(query, extra) {
  const q = nrm(query).replace(/^(la |el |voz |de |del |una )+/g, "");
  if (!q) return { ok: false, reason: "empty" };
  if (celebrityQuery(q)) {
    return {
      ok: false,
      celebrity: true,
      reason:
        "No clono famosos ni actores. Elige una voz del catálogo legal (Edge, OpenAI, Windows).",
    };
  }
  if (/^(jarvis|default|mayordomo|la de siempre|youtube|alarma)$/.test(q)) {
    return { ok: true, voice: defaultVoiceChoice() };
  }
  const all = catalog(extra);
  if (/^(mujer|femenina|female|chica)$/.test(q)) {
    return { ok: true, voice: all.find((v) => v.gender === "female") || all[0] };
  }
  if (/^(hombre|masculina|male|chico|grave)$/.test(q)) {
    return { ok: true, voice: all.find((v) => v.gender === "male") || all[0] };
  }
  let best = null;
  let bestScore = 0;
  for (const v of all) {
    const s = scoreVoice(v, q);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  if (!best || bestScore < 20) {
    return { ok: false, reason: "not-found" };
  }
  return { ok: true, voice: best };
}

function parseVoiceCommand(raw) {
  const t = nrm(raw);
  if (/^(lista|enumera|que|cuales).{0,20}voces/.test(t) || /^voces disponibles/.test(t)) {
    return { type: "list_voices" };
  }
  const m = String(raw)
    .trim()
    .match(
      /^(?:habla con(?: la)? voz(?: de| del| de la)?|cambia(?: la)? voz a|usa(?: la)? voz(?: de)?|pon(?: la)? voz(?: de)?|switch voice to)\s+(.+)$/i
    );
  if (m && m[1]) return { type: "set_voice", query: m[1].replace(/[?.!]+$/g, "").trim() };
  return null;
}

function formatVoiceLine(v) {
  return `${v.label} (${v.engine}${v.lang ? " · " + v.lang : ""})`;
}

module.exports = {
  OPENAI_VOICES,
  EDGE_VOICES,
  catalog,
  defaultVoiceChoice,
  resolveVoice,
  celebrityQuery,
  parseVoiceCommand,
  formatVoiceLine,
};
