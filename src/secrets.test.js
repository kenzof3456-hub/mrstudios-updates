const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadSecrets, saveApiKey } = require("./secrets");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-secrets-"));
assert.strictEqual(loadSecrets(dir).openaiApiKey, "");
const saved = saveApiKey(dir, "sk-test-key");
assert.strictEqual(saved.hasKey, true);
assert.strictEqual(loadSecrets(dir).openaiApiKey, "sk-test-key");
assert.strictEqual(saveApiKey(dir, "  ").hasKey, false);
assert.strictEqual(loadSecrets(dir).openaiApiKey, "");
console.log("secrets ok");
