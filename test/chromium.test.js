import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { test } from 'node:test';
import { ensureChromiumOnPath, resolveChromiumExecutable } from '../src/chromium.js';

test('resolveChromiumExecutable finds a browser in this environment', () => {
  const found = resolveChromiumExecutable();
  assert.ok(found, 'expected Chromium or Chrome to be installed in the test VM');
  assert.equal(fs.existsSync(found), true);
});

test('ensureChromiumOnPath makes `chromium` resolvable', () => {
  const executable = ensureChromiumOnPath();
  const which = execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim();
  assert.ok(which);
  assert.equal(fs.existsSync(executable), true);
});
