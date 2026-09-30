function nrm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function looksLikeFaceAsk(raw) {
  const t = nrm(raw);
  return /(quien es (esta|este|esa|ese)( persona| hombre| mujer| chica| chico)?|esta persona|esa cara|busca (esta|esa) (cara|persona|face)|identifica(r)? (a |esta |la )?(persona|cara|face)|reconoc(e|er) (la )?cara|who is (this|that)( person| man| woman| girl| guy)?|identify (this|that) (person|face)|face search)/.test(
    t
  );
}

function facePrompt(lang, question) {
  const inLang = lang === "en" ? "English" : lang === "es" ? "Spanish" : "the user's language";
  return [
    `You are Jarvis speaking to Señor in ${inLang}.`,
    "This is a user-initiated still image (attach or screen), not a live webcam.",
    "Count human faces. Line: FACES: <integer>.",
    "For each face, line: ID: <public figure name if clearly famous> or ID: UNKNOWN.",
    "Never invent a name. Never guess a private individual. Never output home address, phone, email, workplace, school, or how to find a private person.",
    "Public figures: name + why they are known, briefly. Unknown: say you cannot identify them.",
    "Final line: BUSCAR: <wikipedia-style query for a public figure only, or UNKNOWN>.",
    question ? `Señor: ${question}` : "Señor attached or showed this image.",
  ].join(" ");
}

function parseFaceVision(raw) {
  const text = String(raw || "").trim();
  const buscar = text.match(/BUSCAR:\s*(.+)$/im);
  const query = buscar ? buscar[1].trim() : "";
  const description = text.replace(/\n?BUSCAR:[\s\S]*$/im, "").trim();
  const facesM = text.match(/FACES:\s*(\d+)/i);
  const ids = [...text.matchAll(/^ID:\s*(.+)$/gim)].map((m) => m[1].trim());
  const qUnknown = /^(unknown|desconocid|n\/a|none|-)$/i.test(query);
  const idsUnknown =
    ids.length === 0 ||
    ids.every((id) => /^(unknown|desconocid|no identificado|n\/a|-)$/i.test(id));
  return {
    description,
    query: qUnknown ? "" : query,
    count: facesM ? Number(facesM[1]) : ids.length,
    ids,
    unknown: idsUnknown,
  };
}

function sanitizeIdentity(text) {
  return String(text || "")
    .replace(/\b(?:\+?\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted]")
    .replace(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g, "[redacted]")
    .replace(
      /\b\d{1,5}\s+[\w.]+\s+(st|street|ave|avenue|rd|road|blvd|calle|avenida|colonia)\b[^\n]*/gi,
      "[redacted]"
    )
    .replace(
      /\b(home address|direccion particular|telefono|celular|ssn|pasaporte|curp|workplace|donde vive|donde trabaja)\b[:\s][^\n]*/gi,
      "[redacted]"
    )
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function publicSearchQuery(report) {
  if (!report || report.unknown) return "";
  const q = String(report.query || "").trim();
  if (!q || /^unknown/i.test(q)) return "";
  const named = (report.ids || []).find((id) => !/unknown|desconocid/i.test(id));
  const seed = named || q;
  return `${seed} wikipedia`;
}

function formatFaceAnswer(lang, report, web) {
  const bits = [];
  if (report.count === 0) {
    bits.push(
      lang === "en"
        ? "I don't see a clear face in that still, Señor."
        : "No veo una cara clara en esa imagen, Señor."
    );
  } else if (report.unknown) {
    bits.push(
      lang === "en"
        ? "There's a person, but I don't know who. I won't invent a name."
        : "Hay una persona, pero no sé quién es. No invento identidades."
    );
  }
  if (report.description) bits.push(sanitizeIdentity(report.description));
  if (web) bits.push(sanitizeIdentity(web));
  bits.push(
    lang === "en"
      ? "Only this still you asked me to look at. No live face tracking, no stranger database."
      : "Solo esta imagen que me pediste. Sin seguimiento de webcam ni álbum de extraños."
  );
  return bits.filter(Boolean).join("\n");
}

module.exports = {
  looksLikeFaceAsk,
  facePrompt,
  parseFaceVision,
  sanitizeIdentity,
  publicSearchQuery,
  formatFaceAnswer,
};
