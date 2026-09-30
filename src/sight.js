const fs = require("fs");
const path = require("path");
const { visionRead } = require("./llm");
const { ocrFile } = require("./ocr");
const { searchWeb, formatSearchAnswer } = require("./search");
const { say } = require("./voice");

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
    };
    return last;
  }

  async function readFrame(question) {
    if (!has()) return null;
    const prompt = [
      "Eres Jarvis. Describe la captura de pantalla de Rabbit en español, cálido y breve.",
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

  async function lookAndAnswer(question, extras) {
    try {
      if (!has() || extras.recapture) await snap();
    } catch {
      return say(
        "Ay, no pude capturar el monitor.",
        "En Windows a veces pide permiso de grabación de pantalla.",
        "Vuelve a decir «mira mi pantalla», Rabbit."
      );
    }
    if (!has()) {
      return say(
        "Ay, no pude capturar el monitor.",
        "En Windows a veces pide permiso de grabación de pantalla.",
        "Vuelve a decir «mira mi pantalla», Rabbit."
      );
    }

    await readFrame(question);
    if (!last.description) {
      return say(
        "Tengo la foto guardada en tu PC.",
        "Sin OPENAI_API_KEY (visión) ni OCR (tesseract) no leo quién o qué es.",
        "Pon la clave o instala tesseract, y repetimos, Rabbit."
      );
    }

    const q = last.query || question || "qué aparece en pantalla";
    const results = await searchWeb(q);
    const web = formatSearchAnswer(q, results);
    return say(
      "¡Ojo a la pantalla, Rabbit!",
      last.description,
      last.method === "ocr" ? "(Lo leí con OCR local, sin nube.)" : "",
      web
    );
  }

  return { has, snap, lookOnly, lookAndAnswer, getLast: () => last };
}

module.exports = { createSight, parseVision };
