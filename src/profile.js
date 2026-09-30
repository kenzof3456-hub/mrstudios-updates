const fs = require("fs");
const path = require("path");

const DEFAULT_PROFILE = {
  realName: "Luis",
  nickname: "Rabbit",
  os: "Windows",
  locale: "es-MX",
};

function profilePath(userDataDir) {
  return path.join(userDataDir, "profile.json");
}

function loadProfile(userDataDir) {
  const file = profilePath(userDataDir);
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch {
    // fall through to defaults
  }
  saveProfile(userDataDir, DEFAULT_PROFILE);
  return { ...DEFAULT_PROFILE };
}

function saveProfile(userDataDir, profile) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    profilePath(userDataDir),
    JSON.stringify({ ...DEFAULT_PROFILE, ...profile }, null, 2),
    "utf8"
  );
}

function describeProfile(profile) {
  return (
    `Rabbit, tu nombre real es ${profile.realName}. ` +
    `Te hablo como ${profile.nickname}. ` +
    `Sistema: ${profile.os}.`
  );
}

module.exports = {
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
  describeProfile,
};
