const { EDGE_VOICES } = require("./voices");

function nrm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const NAMES = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
};

const LOCALES = {
  es: "es-MX",
  en: "en-GB",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  ja: "ja-JP",
  zh: "zh-CN",
  ko: "ko-KR",
};

const LEX = {
  en: "the and you what is are this that have for with please open close remember forget time who how why can will just about from they your",
  es: "que los las una por para con una este esta abre cierra recuerda olvida hora quien como estas estoy tambien pero porque",
  pt: "nao uma para voce com esta isso obrigado abrir fechar hora quem como",
  fr: "est une des les pas vous avec pour merci ouvre ferme heure qui comment",
  de: "und nicht ich das die der ist bitte öffnen schließen uhr wer wie",
  it: "che non una per con questo grazie apri chiudi ora chi come",
};

function lexSet(code) {
  return new Set(LEX[code].split(/\s+/));
}

const SETS = Object.fromEntries(Object.keys(LEX).map((k) => [k, lexSet(k)]));

function detectLanguage(text, fallback = "es") {
  const raw = String(text || "").trim();
  if (!raw) return fallback || "es";
  if (/[\u3040-\u30ff]/.test(raw)) return "ja";
  if (/[\uac00-\ud7af]/.test(raw)) return "ko";
  if (/[\u4e00-\u9fff]/.test(raw)) return "zh";

  const tokens = nrm(raw)
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);
  const scores = { es: 0, en: 0, pt: 0, fr: 0, de: 0, it: 0 };
  if (/[áéíóúñ¿¡]/i.test(raw)) scores.es += 4;
  if (/[ãõç]/i.test(raw)) scores.pt += 4;
  if (/[àâêëïùœç]/i.test(raw)) scores.fr += 3;
  if (/[äöüß]/i.test(raw)) scores.de += 4;

  for (const w of tokens) {
    for (const code of Object.keys(SETS)) {
      if (SETS[code].has(w)) scores[code] += 2;
    }
  }

  let best = fallback || "es";
  let bestN = 0;
  for (const [code, n] of Object.entries(scores)) {
    if (n > bestN) {
      bestN = n;
      best = code;
    }
  }
  if (bestN < 2) return fallback || "es";
  return best;
}

function localeFor(code) {
  return LOCALES[code] || LOCALES.es;
}

function languageName(code) {
  return NAMES[code] || NAMES.es;
}

function voiceLangMatches(voice, lang) {
  if (!voice) return false;
  if (voice.engine === "openai") return true;
  const vl = String(voice.lang || voice.id || "").toLowerCase();
  return vl.startsWith(String(lang || "").toLowerCase());
}

function defaultVoiceForLang(lang, gender) {
  const g = gender === "female" ? "female" : "male";
  const hit =
    EDGE_VOICES.find((v) => v.lang.toLowerCase().startsWith(lang) && v.gender === g) ||
    EDGE_VOICES.find((v) => v.lang.toLowerCase().startsWith(lang));
  if (hit) return { ...hit };
  return {
    engine: "edge",
    id: lang === "en" ? "en-GB-RyanNeural" : "es-ES-AlvaroNeural",
    label: lang === "en" ? "Ryan · en-GB" : "Álvaro · es-ES",
    lang: lang === "en" ? "en-GB" : "es-ES",
    gender: "male",
  };
}

function ttsVoiceFor(profile) {
  const lang = (profile && profile.language) || "es";
  const choice = (profile && profile.voice) || defaultVoiceForLang("es", "male");
  if (voiceLangMatches(choice, lang)) return choice;
  return defaultVoiceForLang(lang, choice.gender);
}

/** Canned copy: Spanish or English; other languages use English canned + LLM for free-form. */
function tx(lang, es, en) {
  return lang === "es" ? es : en;
}

module.exports = {
  detectLanguage,
  localeFor,
  languageName,
  voiceLangMatches,
  defaultVoiceForLang,
  ttsVoiceFor,
  tx,
};
