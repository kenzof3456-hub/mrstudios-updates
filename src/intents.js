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
    /(olvida(lo)? todo|borra (todo )?lo que sabes|borra toda la memoria|reset(ea)? (la )?memoria|forget everything)/.test(
      t
    )
  ) {
    return { type: "forget_all" };
  }

  if (
    /(que sabes de mi|que recuerdas( de mi)?|que conoces de mi|tu memoria|datos guardados|que sabes sobre mi)/.test(
      t
    )
  ) {
    return { type: "recall" };
  }

  const forget = t.match(
    /^(olvida|borra|no recuerdes|forget)\s+(?:que |el dato |lo de |el hecho )?(.*)$/
  );
  if (forget && forget[2] && !/^todo\b/.test(forget[2])) {
    return { type: "forget", query: forget[2].trim() };
  }

  const remember = t.match(
    /^(recuerda|guarda|anota|no olvides|remember)\s+(?:que )?(.*)$/
  );
  if (remember && remember[2]) {
    return { type: "remember", fact: String(raw).replace(/^(recuerda|guarda|anota|no olvides|remember)\s+(que\s+)?/i, "").trim() };
  }

  if (
    /^(me gusta|no me gusta|prefiero|odio|siempre uso|uso mucho|mi (app|juego|horario|atajo|discord)|me dices|me llamas|mi nombre)/.test(
      t
    )
  ) {
    return { type: "remember", fact: String(raw).trim() };
  }

  if (
    /(mira|ve|ver|echa un vistazo|captura|screenshot|fotografia).{0,50}(pantalla|screen|monitor|escritorio)|mira mi pantalla|look at (my )?(screen|display)/.test(
      t
    )
  ) {
    const alsoAsk =
      /(esto|eso|quien es|que es|busca|persona|que hay|que estoy viendo|informacion|de la pantalla)/.test(
        t
      );
    return {
      type: alsoAsk ? "look_ask" : "look_screen",
      query: String(raw).trim(),
    };
  }

  if (
    /(esto|eso|en (la )?pantalla|esta captura|lo que (ves|estas viendo)|esta persona|quien es (este|esta|ese|esa)|busca (esto|eso))/.test(
      t
    )
  ) {
    return { type: "screen_ask", query: String(raw).trim() };
  }

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
