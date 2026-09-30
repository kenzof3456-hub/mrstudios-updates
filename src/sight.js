const fs = require("fs");
const path = require("path");
const { visionRead } = require("./llm");
const { ocrFile } = require("./ocr");
const { searchWeb, formatSearchAnswer } = require("./search");
const { say } = require("./voice");
const { kindOf, readTextSnippet, copyIntoUploads, fileToDataUrl } = require("./attach");
const {
  looksLikeFaceAsk,
  facePrompt,
  parseFaceVision,
  sanitizeIdentity,
  publicSearchQuery,
  formatFaceAnswer,
} = require("./faces");

function parseVision(raw) {
  const text = String(raw || "").trim();
  const m = text.match(/BUSCAR:\s*(.+)$/im);
  const query = m ? m[1].trim() : "";
  const description = text.replace(/\n?BUSCAR:[\s\S]*$/im, "").trim();
  return { description, query: query || description.slice(0, 80) };
}

function createSight({ dir, captureFn, llm }) {
  let last = null;

  function has() {
    return Boolean(last && last.path && fs.existsSync(last.path));
  }

  function getLast() {
    return last;
  }

  async function snap() {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "last-screen.png");
    const cap = await captureFn(file);
    last = {
      path: cap.path,
      dataUrl: cap.dataUrl,
      at: Date.now(),
      description: null,
      query: null,
      kind: "image",
      source: "screen",
      name: "pantalla",
      text: "",
    };
    return last;
  }

  function ingestPath(srcPath, originalName) {
    const dest = copyIntoUploads(dir, srcPath);
    const kind = kindOf(dest);
    const name = originalName || path.basename(srcPath);
    last = {
      path: dest,
      dataUrl: kind === "image" ? fileToDataUrl(dest) : "",
      at: Date.now(),
      description: null,
      query: null,
      kind,
      source: "attach",
      name,
      text: kind === "text" ? readTextSnippet(dest) : "",
    };
    if (kind === "image") {
      const persist = path.join(dir, "last-attach" + path.extname(dest).toLowerCase());
      fs.copyFileSync(dest, persist);
      last.path = persist;
    }
    return last;
  }

  async function readFrame(question, lang) {
    if (!has() || last.kind !== "image") return null;
    const prompt = facePrompt(lang, question);

    const vision = await visionRead({
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl,
      model: llm.visionModel || llm.model,
      dataUrl: last.dataUrl,
      prompt,
    });
    if (vision) {
      const parsed = parseFaceVision(vision);
      last.description = parsed.description;
      last.query = parsed.query;
      last.method = "vision";
      last.faces = parsed;
      return last;
    }

    const ocr = await ocrFile(last.path);
    if (ocr) {
      last.description = `Texto que pude leer (OCR local): ${ocr}`;
      last.query = ocr.slice(0, 90);
      last.method = "ocr";
      last.faces = { count: 0, ids: [], unknown: true, description: last.description, query: "" };
      return last;
    }

    last.description = "";
    last.query = "";
    last.method = "none";
    last.faces = { count: 0, ids: [], unknown: true, description: "", query: "" };
    return last;
  }

  async function lookOnly(lang) {
    try {
      await snap();
    } catch {
      return say(
        lang === "en"
          ? "Couldn't see the display. On Windows, allow screen capture for Jarvis."
          : "No pude ver el monitor. En Windows, permite captura de pantalla a Jarvis."
      );
    }
    return say(
      lang === "en"
        ? "Got the screen. Local only. Ask what or who it is."
        : "Tengo la pantalla. Solo en el PC. Pregunta qué o quién es."
    );
  }

  async function lookImage(question, extras) {
    try {
      if (!has() || extras.recapture) await snap();
    } catch {
      return say(
        "Ay, no pude capturar el monitor.",
        "En Windows a veces pide permiso de grabación de pantalla.",
        "Vuelve a decir «mira mi pantalla», Señor."
      );
    }
    if (!has() || last.kind !== "image") {
      return say(
        "Ay, no pude capturar el monitor.",
        "En Windows a veces pide permiso de grabación de pantalla.",
        "Vuelve a decir «mira mi pantalla», Señor."
      );
    }

    await readFrame(question, extras && extras.lang);
    const lang = extras && extras.lang;
    const faceAsk = looksLikeFaceAsk(question) || (last.faces && last.faces.count > 0);
    if (!last.description && !(last.faces && last.faces.count)) {
      return say(
        lang === "en"
          ? "I have the image on disk. Vision API needed to read faces. I won't invent a name."
          : "Tengo la imagen en el PC. Falta visión (API) para caras. No invento un nombre."
      );
    }

    const report = last.faces || parseFaceVision(last.description || "");
    const searchQ = faceAsk ? publicSearchQuery(report) : last.query || question || "";
    let web = "";
    if (searchQ && !report.unknown) {
      const results = await searchWeb(searchQ);
      web = formatSearchAnswer(searchQ, results, lang);
    }
    if (faceAsk || (report.count && report.count > 0)) {
      return sanitizeIdentity(formatFaceAnswer(lang, report, web));
    }

    const q = last.query || question || "what's in the image";
    const results = await searchWeb(q);
    const web2 = formatSearchAnswer(q, results, lang);
    return sanitizeIdentity(say(last.description, web2));
  }

  async function lookAndAnswer(question, extras) {
    return lookImage(question, extras || {});
  }

  async function lookAttached(question, lang) {
    const extras = { recapture: false, lang };
    if (!last || !last.path) {
      return say(
        lang === "en"
          ? "No file yet. Use Attach, then ask."
          : "No hay archivo. Pulsa Adjuntar y pregunta."
      );
    }
    if (last.kind === "image") {
      return lookImage(question, extras);
    }
    if (last.kind === "text") {
      const snippet = last.text || readTextSnippet(last.path);
      last.text = snippet;
      const q = String(question || last.name || "document").slice(0, 120);
      const results = await searchWeb(q);
      const web = snippet ? "" : formatSearchAnswer(q, results, lang);
      return say(
        `«${last.name}»`,
        snippet ? snippet.slice(0, 900) : lang === "en" ? "Couldn't read it as text." : "No pude leerlo como texto.",
        web
      );
    }
    if (last.kind === "audio") {
      return say(
        lang === "en"
          ? "I won't clone voices from a sample. Pick a legal voice in the list."
          : "No clono voces de una muestra. Elige una voz legal en el selector."
      );
    }
    return say(
      lang === "en"
        ? `Saved «${last.name}» locally. Photos and .txt I can read.`
        : `Guardé «${last.name}». Fotos y .txt sí los leo.`
    );
  }

  return {
    has,
    snap,
    ingestPath,
    lookOnly,
    lookAndAnswer,
    lookAttached,
    getLast,
  };
}

module.exports = { createSight, parseVision };
