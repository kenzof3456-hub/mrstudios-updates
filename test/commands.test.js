import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commands } from '../src/commands.js';

test('registers /start /status /stop', () => {
  assert.deepEqual(
    commands.map((command) => command.name),
    ['start', 'status', 'stop'],
  );
  for (const command of commands) {
    assert.ok(command.description.length > 0);
    assert.equal(command.dm_permission, false);
  }
});
