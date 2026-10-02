const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const {
  parseSendMessage,
  preferredAppFromMemory,
  resolveWho,
  canonicalApp,
} = require("./send-parse");
const { createMemory } = require("./memory");

const p = parseSendMessage("manda un mensaje a mamá por WhatsApp que ya voy");
assert.strictEqual(p.type, "send_message");
assert.match(p.to, /mam/i);
assert.match(p.body, /voy/i);
assert.strictEqual(p.app, "whatsapp");

const p2 = parseSendMessage("dile a Pedro que llegué");
assert.strictEqual(p2.app, null);
assert.match(p2.to, /pedro/i);
assert.match(p2.body, /lleg/i);

assert.strictEqual(parseSendMessage("qué hora es"), null);
assert.strictEqual(canonicalApp("wasap"), "whatsapp");
assert.strictEqual(canonicalApp("correo"), "email");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-send-"));
const memory = createMemory(path.join(dir, "memory.json"));
memory.add("usa WhatsApp para mamá");
memory.add("mamá es María");
assert.strictEqual(preferredAppFromMemory(memory, "mamá"), "whatsapp");
memory.add("para luis usa discord");
assert.strictEqual(preferredAppFromMemory(memory, "Luis"), "discord");

const who = resolveWho(memory, "mamá");
assert.strictEqual(who.label.toLowerCase().includes("mam"), true);
assert.match(who.search, /María|Maria/i);

const mem2 = createMemory(path.join(dir, "m2.json"));
mem2.add("el correo de ana es ana@example.com");
assert.strictEqual(resolveWho(mem2, "ana").search, "ana@example.com");

console.log("send-parse ok");
