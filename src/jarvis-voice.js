/** Legal style-match for Iron Man J.A.R.V.I.S. — no actor cloning. */

const CLIP = {
  url: "https://www.youtube.com/watch?v=uneoc9zZan0",
  title: "Audio de Jarvis(despertador de cada) mañana parte 3",
  channel: "THExMISIOxYT",
  note:
    "Fan Spanish morning-alarm in the J.A.R.V.I.S. character (Iron Man). Not a license to clone Paul Bettany or the film mix.",
};

/**
 * Default stack (first that works):
 * 1. Microsoft Edge neural es-ES-AlvaroNeural — refined Castilian male (Spanish analogue of the butler).
 * 2. en-GB-RyanNeural — UK male JARVIS timbre on the same Edge service.
 * 3. OpenAI fable — British male.
 * 4. Windows SAPI male (George / Jorge / Pablo / Alvaro).
 * 5. Chromium speechSynthesis male.
 */
const JARVIS_TTS = {
  edgeVoices: ["es-ES-AlvaroNeural", "en-GB-RyanNeural"],
  edgeRate: "-8%",
  edgePitch: "-6%",
  openaiVoice: "fable",
  openaiModel: "tts-1",
  openaiSpeed: 0.97,
  browserLang: "es-ES",
  browserRate: 0.96,
  browserPitch: 0.9,
};

const BROWSER_VOICE_PREFER = [
  /ollie/i,
  /george/i,
  /ryan/i,
  /daniel/i,
  /alvaro/i,
  /jorge/i,
  /pablo/i,
  /diego/i,
  /en-gb/i,
  /english united kingdom/i,
  /microsoft david/i,
];

const BROWSER_VOICE_SKIP = [
  /helena|sabina|elvira|monica|laura|pilar|paulina|zira|hazel|susan|sabina|nova|shimmer/i,
];

function rankBrowserVoice(voices) {
  const list = Array.isArray(voices) ? voices : [];
  const scored = list
    .filter((v) => !BROWSER_VOICE_SKIP.some((re) => re.test(v.name || "")))
    .map((v) => {
      let score = 0;
      const blob = `${v.name || ""} ${v.lang || ""}`;
      if (/^en(-|_)GB/i.test(v.lang) && /male/i.test(v.name)) score += 8;
      if (/^en(-|_)GB/i.test(v.lang)) score += 6;
      if (/^es(-|_)ES/i.test(v.lang)) score += 5;
      if (/^es/i.test(v.lang)) score += 3;
      if (BROWSER_VOICE_PREFER.some((re) => re.test(blob))) score += 10;
      if (/male/i.test(v.name)) score += 2;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0] ? scored[0].v : list[0] || null;
}

module.exports = {
  CLIP,
  JARVIS_TTS,
  BROWSER_VOICE_PREFER,
  rankBrowserVoice,
};
