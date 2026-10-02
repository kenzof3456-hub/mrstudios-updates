const assert = require("assert");
const { parsePlan, intentFromPlan } = require("./plan");

assert.strictEqual(parsePlan("nope"), null);
const p = parsePlan('{"action":"craft","query":"bot de Discord","need_web":false}');
assert.strictEqual(p.action, "craft");
assert.strictEqual(intentFromPlan(p, "x").type, "craft");
assert.strictEqual(intentFromPlan({ action: "execute", query: "" }, "").type, "do_last");
assert.strictEqual(intentFromPlan({ action: "tv", query: "Japón" }, "").type, "tv");
assert.strictEqual(intentFromPlan({ action: "answer", query: "café", need_web: false }, "").need_web, false);

const omitted = parsePlan('{"action":"answer","query":"quién es X"}');
assert.strictEqual(omitted.need_web, false);
assert.strictEqual(intentFromPlan(omitted, "quién es X").need_web, false);

const chat = parsePlan('{"action":"chat","query":"me aburro"}');
assert.strictEqual(chat.action, "chat");
assert.strictEqual(chat.need_web, false);
assert.strictEqual(intentFromPlan(chat, "me aburro").need_web, false);

const searchAct = parsePlan('{"action":"search","query":"docs electron"}');
assert.strictEqual(searchAct.need_web, true);

const hora = parsePlan('{"action":"datetime","query":""}');
assert.strictEqual(hora.need_web, false);

const app = parsePlan('{"action":"open_app","app":"chrome"}');
assert.strictEqual(app.need_web, false);

console.log("plan ok");
