function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function stripAppFiller(name) {
  return String(name || "")
    .replace(/^(la |el |los |las |app |aplicacion |programa |de )+/i, "")
    .replace(/[?.!]+$/g, "")
    .trim();
}

function detectIntent(raw) {
  const t = normalize(raw);
  if (!t) return { type: "empty" };

  if (
    /(camara|camera|webcam|video).{0,40}(discord)|(discord).{0,40}(camara|camera|webcam|video)/.test(
      t
    ) ||
    /(enciende|prende|activa|abre|pon|toggle).{0,20}(la )?(camara|camera|webcam)/.test(t)
  ) {
    return { type: "discord_camera" };
  }

  if (
    /(que hora|hora actual|hora es|que fecha|fecha de hoy|que dia|dia de la semana|que dia es|dime la hora|hora y fecha)/.test(
      t
    )
  ) {
    return { type: "datetime" };
  }

  if (
    /(quien soy|quien es rabbit|mi perfil|como me llamo|quien es luis|datos de usuario)/.test(
      t
    )
  ) {
    return { type: "profile" };
  }

  const close = t.match(
    /^(cierra|cerrar|mata|matar|termina|cierra me|close|kill)\s+(?:la |el |app |aplicacion |programa )?(.*)$/
  );
  if (close && stripAppFiller(close[2])) {
    return { type: "close_app", app: stripAppFiller(close[2]) };
  }

  const open = t.match(
    /^(abre|abrir|inicia|iniciar|abre me|lanza|open|start)\s+(?:la |el |app |aplicacion |programa )?(.*)$/
  );
  if (open && stripAppFiller(open[2])) {
    const app = stripAppFiller(open[2]);
    if (/discord/.test(app) && /(camara|camera|webcam|video)/.test(t)) {
      return { type: "discord_camera" };
    }
    return { type: "open_app", app };
  }

  return { type: "question", query: String(raw).trim() };
}

module.exports = { detectIntent, normalize };
