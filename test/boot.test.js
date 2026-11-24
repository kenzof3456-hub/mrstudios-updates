import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('index.js exits with a clear error when credentials are missing', () => {
  const result = spawnSync(process.execPath, ['src/index.js'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      DISCORD_TOKEN: '',
      ATERNOS_USERNAME: '',
      ATERNOS_PASSWORD: '',
      ATERNOS_USER: '',
      ATERNOS_PASS: '',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Faltan variables de entorno: DISCORD_TOKEN, ATERNOS_USERNAME, ATERNOS_PASSWORD/);
});
