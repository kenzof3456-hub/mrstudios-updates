const assert = require("assert");
const { detectIntent } = require("./intents");

const cases = [
  ["¿Qué hora es?", "datetime"],
  ["dime la fecha de hoy", "datetime"],
  ["quién soy", "profile"],
  ["abre chrome", "open_app"],
  ["cierra discord", "close_app"],
  ["enciende la cámara de Discord", "discord_camera"],
  ["prende la camara de discord", "discord_camera"],
  ["¿Qué es un agujero negro?", "question"],
  ["recuerda que uso Discord por las tardes", "remember"],
  ["me gusta el café", "remember"],
  ["qué sabes de mí", "recall"],
  ["olvida el café", "forget"],
  ["olvida todo", "forget_all"],
  ["mira mi pantalla", "look_screen"],
  ["mira esto", "look_attach"],
  ["mira esta foto", "look_attach"],
  ["mira la pantalla y busca quién es", "look_ask"],
  ["qué es esto", "screen_ask"],
  ["manda un mensaje a mamá por WhatsApp que ya voy", "send_message"],
  ["dile a Pedro que llegué", "send_message"],
  ["habla con voz de Jorge", "set_voice"],
  ["cambia la voz a Nova", "set_voice"],
  ["lista las voces", "list_voices"],
];

for (const [text, type] of cases) {
  const got = detectIntent(text);
  assert.strictEqual(got.type, type, `${text} => ${got.type}, expected ${type}`);
}

assert.strictEqual(detectIntent("abre el bloc de notas").app.includes("bloc"), true);
assert.strictEqual(detectIntent("dile a Pedro que llegué").to.toLowerCase().includes("pedro"), true);
assert.match(detectIntent("manda un mensaje a mamá por WhatsApp que ya voy").body, /voy/i);
assert.strictEqual(detectIntent("manda un mensaje a mamá por WhatsApp que ya voy").app, "whatsapp");
console.log("intents ok");
