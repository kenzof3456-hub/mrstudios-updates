const fs = require("fs");
const path = require("path");
const { visionRead } = require("./llm");
const { ocrFile } = require("./ocr");
const { searchWeb, formatSearchAnswer } = require("./search");
const { say } = require("./voice");
const { kindOf, readTextSnippet, copyIntoUploads, fileToDataUrl } = require("./attach");

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

  async function readFrame(question) {
    if (!has() || last.kind !== "image") return null;
    const prompt = [
      "Eres Jarvis. Describe la imagen de Rabbit en español, cálido y breve.",
      "Si hay una persona, di quién parece (nombre si es evidente, si no: descripción).",
      "Al final, UNA línea exactamente: BUSCAR: <consulta web corta del sujeto principal>.",
      question ? `Pregunta de Rabbit: ${question}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const vision = await visionRead({
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl,
      model: llm.visionModel || llm.model,
      dataUrl: last.dataUrl,
      prompt,
    });
    if (vision) {
      const parsed = parseVision(vision);
      last.description = parsed.description;
      last.query = parsed.query;
      last.method = "vision";
      return last;
    }

    const ocr = await ocrFile(last.path);
    if (ocr) {
      last.description = `Texto que pude leer (OCR local): ${ocr}`;
      last.query = ocr.slice(0, 90);
      last.method = "ocr";
      return last;
    }

    last.description = "";
    last.query = "";
    last.method = "none";
    return last;
  }

  async function lookOnly() {
    try {
      await snap();
    } catch {
      return say(
        "Ay, no pude ver el monitor, Rabbit.",
        "En Windows: Configuración → Privacidad → Captura de pantalla, y permite a Jarvis.",
        "Nunca miro si tú no me lo pides."
      );
    }
    return say(
      "¡Listo, Rabbit!",
      "Ya tengo tu pantalla. Solo aquí, en el PC. No la subo a ningún lado salvo el modelo que tú configuraste, si preguntas.",
      "Dime «qué es esto» o «quién es» y me lanzo."
    );
  }

  async function lookImage(question, extras) {
    try {
      if (!has() || extras.recapture) await snap();
    } catch {
      return say(
        "Ay, no pude capturar el monitor.",
        "En Windows a veces pide permiso de grabación de pantalla.",
        "Vuelve a decir «mira mi pantalla», Rabbit."
      );
    }
    if (!has() || last.kind !== "image") {
      return say(
        "Ay, no pude capturar el monitor.",
        "En Windows a veces pide permiso de grabación de pantalla.",
        "Vuelve a decir «mira mi pantalla», Rabbit."
      );
    }

    await readFrame(question);
    if (!last.description) {
      return say(
        last.source === "attach"
          ? "Tengo tu foto guardada en el PC."
          : "Tengo la foto guardada en tu PC.",
        "Sin OPENAI_API_KEY (visión) ni OCR (tesseract) no leo quién o qué es.",
        "Pon la clave o instala tesseract, y repetimos, Rabbit.",
        "No la subo a ningún otro sitio."
      );
    }

    const q = last.query || question || "qué aparece en la imagen";
    const results = await searchWeb(q);
    const web = formatSearchAnswer(q, results);
    return say(
      last.source === "attach" ? "¡Ojo al archivo, Rabbit!" : "¡Ojo a la pantalla, Rabbit!",
      last.description,
      last.method === "ocr" ? "(Lo leí con OCR local, sin nube.)" : "",
      web
    );
  }

  async function lookAndAnswer(question, extras) {
    return lookImage(question, extras || {});
  }

  async function lookAttached(question) {
    if (!last || !last.path) {
      return say(
        "No tengo ningún archivo todavía, Rabbit.",
        "Pulsa Adjuntar abajo — fotos, capturas o un txt — y luego «mira esto»."
      );
    }
    if (last.kind === "image") {
      return lookImage(question, { recapture: false });
    }
    if (last.kind === "text") {
      const snippet = last.text || readTextSnippet(last.path);
      last.text = snippet;
      const q = String(question || last.name || "documento").slice(0, 120);
      const results = await searchWeb(q);
      const web = snippet ? "" : formatSearchAnswer(q, results);
      return say(
        `¡Lo tengo, Rabbit! «${last.name}».`,
        "Quedó solo en tu PC. No lo subo a ningún lado salvo el modelo que configuraste, si hace falta.",
        snippet
          ? `Empieza así:\n${snippet.slice(0, 900)}`
          : "Está vacío o no pude leerlo como texto.",
        web
      );
    }
    if (last.kind === "audio") {
      return say(
        "Oigo el archivo, Rabbit, pero no clono voces de personas ni famosos.",
        "Elige una voz legal en el selector de arriba o dime «habla con voz de Jorge».",
        "Catálogo: Edge neural, OpenAI y las voces de Windows."
      );
    }
    return say(
      `Guardé «${last.name}» en tu PC.`,
      "No extraigo Word/PDF/binarios en v1. Si es una foto o un .txt, ahí sí me lanzo.",
      "No lo subí a ningún otro sitio."
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
