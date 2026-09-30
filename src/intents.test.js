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
];

for (const [text, type] of cases) {
  const got = detectIntent(text);
  assert.strictEqual(got.type, type, `${text} => ${got.type}, expected ${type}`);
}

assert.strictEqual(detectIntent("abre el bloc de notas").app.includes("bloc"), true);
console.log("intents ok");
