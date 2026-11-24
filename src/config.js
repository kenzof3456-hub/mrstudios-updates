const ENV_ALIASES = {
  aternosUsername: ['ATERNOS_USERNAME', 'ATERNOS_USER'],
  aternosPassword: ['ATERNOS_PASSWORD', 'ATERNOS_PASS'],
};

function firstValue(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function readEnv(env = process.env) {
  return {
    discordToken: firstValue(env, ['DISCORD_TOKEN']),
    discordGuildId: firstValue(env, ['DISCORD_GUILD_ID']),
    allowedRoleId: firstValue(env, ['DISCORD_ALLOWED_ROLE_ID']),
    aternosUsername: firstValue(env, ENV_ALIASES.aternosUsername),
    aternosPassword: firstValue(env, ENV_ALIASES.aternosPassword),
    aternosServerId: firstValue(env, ['ATERNOS_SERVER_ID']),
    aternosServerName: firstValue(env, ['ATERNOS_SERVER_NAME']),
  };
}

export function loadConfig(env = process.env) {
  const config = readEnv(env);
  const missing = [];

  if (!config.discordToken) missing.push('DISCORD_TOKEN');
  if (!config.aternosUsername) missing.push('ATERNOS_USERNAME');
  if (!config.aternosPassword) missing.push('ATERNOS_PASSWORD');

  if (missing.length > 0) {
    const error = new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
    error.code = 'MISSING_ENV';
    error.missing = missing;
    throw error;
  }

  return config;
}
