const assert = require("assert");
const { parsePlan, intentFromPlan } = require("./plan");

assert.strictEqual(parsePlan("nope"), null);
const p = parsePlan('{"action":"craft","query":"bot de Discord","need_web":false}');
assert.strictEqual(p.action, "craft");
assert.strictEqual(intentFromPlan(p, "x").type, "craft");
assert.strictEqual(intentFromPlan({ action: "execute", query: "" }, "").type, "do_last");
assert.strictEqual(intentFromPlan({ action: "tv", query: "Japón" }, "").type, "tv");
assert.strictEqual(intentFromPlan({ action: "answer", query: "agujero negro" }, "").type, "question");
console.log("plan ok");
