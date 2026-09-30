const fs = require("fs");
const path = require("path");

const DEFAULT_PROFILE = {
  realName: "Luis",
  nickname: "Señor",
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

function address(profile) {
  return (profile && profile.nickname) || "Señor";
}

function migrate(profile) {
  const next = { ...DEFAULT_PROFILE, ...profile };
  if (!next.nickname || /^rabbit$/i.test(String(next.nickname))) {
    next.nickname = "Señor";
  }
  return next;
}

function loadProfile(userDataDir) {
  const file = profilePath(userDataDir);
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const next = migrate(parsed);
      if (!parsed.nickname || /^rabbit$/i.test(String(parsed.nickname))) {
        saveProfile(userDataDir, next);
      }
      return next;
    }
  } catch {
    // fall through
  }
  saveProfile(userDataDir, DEFAULT_PROFILE);
  return { ...DEFAULT_PROFILE };
}

function saveProfile(userDataDir, profile) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    profilePath(userDataDir),
    JSON.stringify(migrate(profile), null, 2),
    "utf8"
  );
}

function describeProfile(profile, lang = "es") {
  const who = address(profile);
  if (lang === "en") {
    return [
      `You're ${profile.realName}.`,
      `I call you ${who}. Always.`,
      `System: ${profile.os}.`,
    ].join("\n");
  }
  return [
    `Eres ${profile.realName}.`,
    `Te llamo ${who}. Siempre.`,
    `Sistema: ${profile.os}.`,
  ].join("\n");
}

module.exports = {
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
  describeProfile,
  address,
  migrate,
};
