const assert = require("assert");
const { whisperTranscribe, windowsDictation } = require("./stt");
const { withTimeout } = require("./timeout");

assert.strictEqual(typeof whisperTranscribe, "function");
assert.strictEqual(typeof windowsDictation, "function");

(async () => {
  const empty = await whisperTranscribe({ apiKey: "", audio: "" });
  assert.strictEqual(empty.ok, false);
  const win = await windowsDictation(3);
  assert.strictEqual(win.ok, false);
  assert.strictEqual(win.reason, "not-windows");
  const v = await withTimeout(new Promise(() => {}), 30, "to");
  assert.strictEqual(v, "to");
  console.log("stt ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
