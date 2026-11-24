import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig, readEnv } from '../src/config.js';

test('readEnv accepts ATERNOS_USER / ATERNOS_PASS aliases', () => {
  const config = readEnv({
    DISCORD_TOKEN: ' token ',
    ATERNOS_USER: 'player',
    ATERNOS_PASS: 'secret',
    ATERNOS_SERVER_NAME: 'Survival',
  });

  assert.equal(config.discordToken, 'token');
  assert.equal(config.aternosUsername, 'player');
  assert.equal(config.aternosPassword, 'secret');
  assert.equal(config.aternosServerName, 'Survival');
});

test('loadConfig throws with missing keys', () => {
  assert.throws(
    () => loadConfig({}),
    (err) => {
      assert.equal(err.code, 'MISSING_ENV');
      assert.deepEqual(err.missing, ['DISCORD_TOKEN', 'ATERNOS_USERNAME', 'ATERNOS_PASSWORD']);
      return true;
    },
  );
});

test('loadConfig accepts a complete env', () => {
  const config = loadConfig({
    DISCORD_TOKEN: 'discord-token',
    ATERNOS_USERNAME: 'user',
    ATERNOS_PASSWORD: 'pass',
    DISCORD_GUILD_ID: '123',
  });

  assert.equal(config.discordToken, 'discord-token');
  assert.equal(config.discordGuildId, '123');
});
