const { say } = require("./voice");
const {
  parseSendMessage,
  preferredAppFromMemory,
  knownNick,
  canonicalApp,
  resolveWho,
  normalize,
} = require("./send-parse");
const { sendOnWindows } = require("./send-win");

function createMessenger({ memory }) {
  let pending = null;

  function clear() {
    pending = null;
  }

  function tryContinue(raw) {
    if (!pending) return null;
    const n = normalize(raw);
    if (/^(cancelar|cancela|olv[ií]dalo|nada|no env[ií]es)$/.test(n)) {
      clear();
      return { consume: true, cancelled: true };
    }
    const app = canonicalApp(raw);
    if (pending.missing === "app" && app) {
      pending.app = app;
      pending.missing = null;
      memory.add(`para ${pending.to} usa ${app}`);
      return { consume: true };
    }
    if (pending.missing === "body" && String(raw).trim().length > 1 && !app) {
      pending.body = String(raw).trim();
      pending.missing = null;
      return { consume: true };
    }
    if (pending.missing === "to" && String(raw).trim().length > 1 && !app) {
      pending.to = String(raw).trim();
      pending.missing = null;
      return { consume: true };
    }
    return { consume: false };
  }

  async function finish() {
    const slot = pending;
    if (!slot) return null;
    const { to, body, app } = slot;
    if (!to || !body || !app) {
      return handleParsed({ to, body, app });
    }
    pending = null;
    const who = resolveWho(memory, to);
    const result = await sendOnWindows(app, who.search, body);
    const dest = who.search !== who.label ? `${who.label} (${who.search})` : who.label;
    if (result.did === "not-windows") {
      return say(
        "Lo tengo claro, Rabbit. Aquí no es Windows.",
        `Iba a mandar a ${dest} por ${app}: «${body}».`,
        result.detail,
        "En tu PC abro la app, busco el contacto, pego el texto y pulso enviar."
      );
    }
    if (result.ok) {
      return say(
        "¡Hecho, Rabbit!",
        `Para ${dest} por ${app}: «${body}».`,
        result.detail
      );
    }
    return say(
      "Casi, Rabbit.",
      `Quería mandar a ${dest} por ${app}: «${body}».`,
      result.detail || "Algo bloqueó el envío.",
      "No invento contactos. Si falta número o correo, dímelo y lo recuerdo."
    );
  }

  async function handleParsed(parsed) {
    const to = (parsed.to || "").trim();
    const body = (parsed.body || "").trim();
    const app = parsed.app || preferredAppFromMemory(memory, to);

    if (!to && !body) {
      pending = { to: "", body: "", app, missing: "to" };
      return say(
        "¡Claro!",
        "¿A quién se lo mando y qué le digo, Rabbit?",
        "Sin destinatario y sin texto no envío nada."
      );
    }
    if (!to) {
      pending = { to: "", body, app, missing: "to" };
      return say("¿A quién, Rabbit?", "Necesito un nombre. No invento contactos.");
    }
    if (!body) {
      pending = { to, body: "", app, missing: "body" };
      return say(
        `¿Qué le digo a ${to}?`,
        "Sin el mensaje no pulso enviar."
      );
    }
    if (!app) {
      pending = { to, body, app: null, missing: "app" };
      const hint = knownNick(memory, to)
        ? `Sé quién es ${to}, pero no por qué app.`
        : `No tengo una app guardada para ${to}.`;
      return say(
        hint,
        "¿WhatsApp, Discord, Telegram, SMS o correo?",
        "Me lo dices una vez y lo recuerdo."
      );
    }

    pending = { to, body, app, missing: null };
    return finish();
  }

  return {
    parseSendMessage,
    tryContinue,
    clear,
    async handleTurnText(raw, parsedIntent) {
      if (pending) {
        const c = tryContinue(raw);
        if (c && c.cancelled) {
          return say("Cancelado.", "No envié nada.");
        }
        if (c && c.consume) return finish();
      }
      if (parsedIntent && parsedIntent.type === "send_message") {
        return handleParsed(parsedIntent);
      }
      if (pending && parsedIntent && parsedIntent.type !== "empty") {
        clear();
      }
      return null;
    },
  };
}

module.exports = { createMessenger };
