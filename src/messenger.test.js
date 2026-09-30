const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { createMemory } = require("./memory");
const { createMessenger } = require("./messenger");
const { handleTurn } = require("./brain");
const { loadProfile } = require("./profile");
const { detectIntent } = require("./intents");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-msg-"));
const memory = createMemory(path.join(dir, "memory.json"));
const messenger = createMessenger({ memory });
const profile = loadProfile(dir);
const llm = { apiKey: "", baseUrl: "", model: "" };

(async () => {
  const ask = await messenger.handleTurnText(
    "dile a Pedro que llegué",
    detectIntent("dile a Pedro que llegué")
  );
  assert.match(ask, /WhatsApp|Discord|Telegram|SMS|correo/i);
  assert.ok(!/Hecho/i.test(ask));

  const remembered = await messenger.handleTurnText("WhatsApp", detectIntent("WhatsApp"));
  assert.match(remembered, /Pedro/i);
  assert.match(remembered, /lleg/i);
  assert.ok(memory.list().some((f) => /whatsapp/i.test(f.text) && /pedro/i.test(f.text)));

  memory.add("usa WhatsApp para mamá");
  const m2 = createMessenger({ memory });
  const direct = await m2.handleTurnText(
    "manda un mensaje a mamá por WhatsApp que ya voy",
    detectIntent("manda un mensaje a mamá por WhatsApp que ya voy")
  );
  assert.match(direct, /mam/i);
  assert.match(direct, /voy/i);

  const refuse = await m2.handleTurnText(
    "manda un mensaje a",
    detectIntent("manda un mensaje a")
  );
  assert.match(refuse, /destinatario|quién|quien/i);

  const turn = await handleTurn({
    text: "Jarvis, dile a Ana que llegué por Discord",
    history: [],
    profile,
    llm,
    memory,
    messenger: createMessenger({ memory }),
  });
  assert.strictEqual(turn.intent, "send_message");
  assert.match(turn.reply, /Ana/i);

  console.log("messenger ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
