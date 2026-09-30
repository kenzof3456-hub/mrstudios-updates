function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const APP_ALIASES = [
  { id: "whatsapp", aliases: ["whatsapp", "whats app", "wasap", "wsp"] },
  { id: "discord", aliases: ["discord"] },
  { id: "telegram", aliases: ["telegram"] },
  { id: "sms", aliases: ["sms", "mensaje de texto"] },
  { id: "email", aliases: ["email", "correo", "gmail", "e-mail"] },
];

function canonicalApp(word) {
  const n = normalize(word);
  if (!n) return null;
  for (const a of APP_ALIASES) {
    for (const al of a.aliases) {
      if (n === al) return a.id;
      if (n.includes(al)) return a.id;
    }
  }
  return null;
}

function looksLikeSend(raw) {
  const t = normalize(raw);
  return /^(envia|manda|mandale|enviarle|escribele|dile|digale|enviale)/.test(t)
    || /\b(mensaje a|mensaje para|mensaje por)\b/.test(t);
}

function parseSendMessage(raw) {
  if (!looksLikeSend(raw)) return null;
  let s = String(raw)
    .trim()
    .replace(/^(oye\s+|hey\s+)?jarvis[,:\s]+/i, "");

  let app = null;
  const appRe =
    /\b(?:por|en|via|usando|desde)\s+(whatsapp|whats\s*app|wasap|wsp|discord|telegram|sms|mensaje de texto|correo|email|gmail|mail)\b/i;
  const am = s.match(appRe);
  if (am) {
    app = canonicalApp(am[1]);
    s = s.replace(appRe, " ");
  }

  s = s
    .replace(
      /^(envía|envia|manda|mándale|mandale|dile|dígale|digale|escríbele|escribele|envíale|enviale)\s+(le\s+)?(un\s+)?(mensaje\s+)?(de\s+texto\s+)?/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  let to = "";
  let body = "";
  const withBody = s.match(/^(?:a|para)\s+(.+?)\s+(?:que|diciendo|:)\s+([\s\S]+)$/i);
  if (withBody) {
    to = withBody[1].trim();
    body = withBody[2].trim();
  } else {
    const onlyTo = s.match(/^(?:a|para)\s+(.+)$/i);
    if (onlyTo) to = onlyTo[1].trim();
  }

  to = to.replace(/[.,;]+$/g, "").trim();
  body = body.replace(/^["«]|["»]$/g, "").trim();

  return { type: "send_message", to, body, app };
}

function preferredAppFromMemory(memory, who) {
  if (!memory || !who) return null;
  const n = normalize(who);
  for (const f of memory.list()) {
    const t = normalize(f.text);
    const paraUsa = t.match(/para\s+(.+?)\s+usa\s+(.+)/);
    if (paraUsa) {
      const person = normalize(paraUsa[1]);
      const app = canonicalApp(paraUsa[2]);
      if (app && (person.includes(n) || n.includes(person))) return app;
    }
    const usaPara = t.match(/usa\s+(.+?)\s+para\s+(.+)/);
    if (usaPara) {
      const app = canonicalApp(usaPara[1]);
      const person = normalize(usaPara[2]);
      if (app && (person.includes(n) || n.includes(person))) return app;
    }
    if (t.includes(n)) {
      const app = canonicalApp(t);
      if (app) return app;
    }
  }
  return null;
}

function knownNick(memory, who) {
  if (!who || !memory) return false;
  const n = normalize(who);
  return memory.list().some((f) => normalize(f.text).includes(n));
}

function extractPhone(text) {
  const m = String(text).match(/\+?\d[\d\s-]{7,}\d/);
  return m ? m[0].replace(/[\s-]/g, "") : null;
}

function extractEmail(text) {
  const m = String(text).match(/[\w.+-]+@[\w.-]+\.\w+/);
  return m ? m[0] : null;
}

/** Use nicknames and stored phone/email from memory.json. Never invent a contact. */
function resolveWho(memory, who) {
  const label = String(who || "").trim();
  if (!label) return { label: "", search: "" };
  if (!memory) return { label, search: label };
  const n = normalize(label);
  for (const f of memory.list()) {
    const raw = f.text;
    const tn = normalize(raw);
    if (!tn.includes(n)) continue;
    const email = extractEmail(raw);
    if (email) return { label, search: email };
    const phone = extractPhone(raw);
    if (phone) return { label, search: phone };
    const called = raw.match(
      new RegExp(
        `(?:${label}|${n})\\s+(?:se llama|es)\\s+([^.,;]+)`,
        "i"
      )
    );
    if (called) {
      const name = called[1].trim();
      if (name && !canonicalApp(name) && name.length > 1) {
        return { label, search: name };
      }
    }
  }
  return { label, search: label };
}

module.exports = {
  parseSendMessage,
  looksLikeSend,
  canonicalApp,
  preferredAppFromMemory,
  knownNick,
  resolveWho,
  normalize,
};
