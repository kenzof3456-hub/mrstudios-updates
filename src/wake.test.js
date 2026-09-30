const assert = require("assert");
const { parseWake } = require("./wake");

assert.deepStrictEqual(parseWake("Jarvis").woke, true);
assert.strictEqual(parseWake("Jarvis").rest, "");
assert.strictEqual(parseWake("Jarvis qué hora es").rest.toLowerCase().includes("hora"), true);
assert.strictEqual(parseWake("oye Jarvis abre chrome").rest.toLowerCase().includes("chrome"), true);
assert.strictEqual(parseWake("qué hora es").woke, false);
assert.strictEqual(parseWake("abre discord").woke, false);
console.log("wake ok");
