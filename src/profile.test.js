const assert = require("assert");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { loadProfile, DEFAULT_PROFILE, describeProfile } = require("./profile");

assert.strictEqual(DEFAULT_PROFILE.nickname, "Señor");
assert.strictEqual(DEFAULT_PROFILE.realName, "Luis");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-profile-"));
const fresh = loadProfile(dir);
assert.strictEqual(fresh.nickname, "Señor");
const saved = JSON.parse(fs.readFileSync(path.join(dir, "profile.json"), "utf8"));
assert.strictEqual(saved.nickname, "Señor");

const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-profile-old-"));
fs.writeFileSync(
  path.join(oldDir, "profile.json"),
  JSON.stringify({ realName: "Luis", nickname: "Rabbit", os: "Windows" }, null, 2)
);
const migrated = loadProfile(oldDir);
assert.strictEqual(migrated.nickname, "Señor");
const persisted = JSON.parse(fs.readFileSync(path.join(oldDir, "profile.json"), "utf8"));
assert.strictEqual(persisted.nickname, "Señor");

assert.match(describeProfile(migrated, "es"), /Señor/);
assert.doesNotMatch(describeProfile(migrated, "es"), /Rabbit/);
console.log("profile ok");
