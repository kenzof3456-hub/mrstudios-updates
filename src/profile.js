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
    `Rabbit, eres ${profile.realName} y te hablo siempre como ${profile.nickname}. ` +
    `Tu sistema es ${profile.os}. Me encanta tenerte por aquí.`
  );
}

module.exports = {
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
  describeProfile,
};
