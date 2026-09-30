const assert = require("assert");
const { parseVision } = require("./sight");

const p = parseVision("Una foto de un gato naranja.\nBUSCAR: gato naranja raza");
assert.match(p.description, /gato/);
assert.match(p.query, /gato naranja/);
console.log("sight parse ok");
