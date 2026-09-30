const assert = require("assert");
const { detectIntent } = require("./intents");
const { clearPendingDanger } = require("./agency");

const cases = [
  ["¿Qué hora es?", "datetime"],
  ["what time is it", "datetime"],
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
  ["quién es esta persona", "screen_ask"],
  ["who is this person", "screen_ask"],
  ["manda un mensaje a mamá por WhatsApp que ya voy", "send_message"],
  ["dile a Pedro que llegué", "send_message"],
  ["habla con voz de Jorge", "set_voice"],
  ["cambia la voz a Nova", "set_voice"],
  ["lista las voces", "list_voices"],
  ["escribe un bot de Discord en javascript", "craft"],
  ["escribe un bot de Discord", "craft"],
  ["script de Blender que crea un cubo y exporta glTF", "craft"],
  ["guarda el codigo", "save_code"],
  ["házmelo", "do_last"],
  ["hazme esto", "do_last"],
  ["do this", "do_last"],
  ["hazme un bot de Discord", "craft"],
  ["formatea el disco", "agency_refuse"],
  ["borra el archivo discord_bot.js", "agency_ask"],
  ["qué echan en Japón", "tv"],
  ["what's on TV in Japan", "tv"],
  ["reparto de The Office", "tv"],
];

for (const [text, type] of cases) {
  const got = detectIntent(text);
  assert.strictEqual(got.type, type, `${text} => ${got.type}, expected ${type}`);
}

assert.strictEqual(detectIntent("hazme un bot de Discord").execute, true);
assert.strictEqual(detectIntent("abre el bloc de notas").app.includes("bloc"), true);
assert.strictEqual(detectIntent("dile a Pedro que llegué").to.toLowerCase().includes("pedro"), true);
assert.match(detectIntent("manda un mensaje a mamá por WhatsApp que ya voy").body, /voy/i);
assert.strictEqual(detectIntent("manda un mensaje a mamá por WhatsApp que ya voy").app, "whatsapp");
clearPendingDanger();
console.log("intents ok");
