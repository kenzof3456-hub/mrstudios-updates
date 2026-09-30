const fs = require("fs");
const path = require("path");

const DEFAULT_PROFILE = {
  realName: "Luis",
  nickname: "Rabbit",
  os: "Windows",
  language: "es",
  locale: "es-MX",
  voice: {
    engine: "edge",
    id: "es-ES-AlvaroNeural",
    label: "Álvaro · es-ES",
    lang: "es-ES",
    gender: "male",
  },
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

function describeProfile(profile, lang = "es") {
  if (lang === "en") {
    return [
      `You're ${profile.realName}.`,
      `I call you ${profile.nickname}. Always.`,
      `System: ${profile.os}.`,
    ].join("\n");
  }
  return [
    `Eres ${profile.realName}.`,
    `Te hablo como ${profile.nickname}. Siempre.`,
    `Sistema: ${profile.os}.`,
  ].join("\n");
}

module.exports = {
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
  describeProfile,
};
