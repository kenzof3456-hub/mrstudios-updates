import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAternosController, selectServer } from '../src/aternos.js';

const servers = [
  { id: 'abc', name: 'Survival', status: 'offline', software: 'Paper 1.21', players: '0/20' },
];

function mockApi({ list = servers, startResult, stopResult, failAuthOnce = false } = {}) {
  let logins = 0;
  const calls = [];
  return {
    calls,
    async loginToAternos(user, pass) {
      logins += 1;
      calls.push(['login', user, pass]);
      return [{ name: 'ATERNOS_SESSION', value: `session-${logins}` }];
    },
    async getServerList() {
      calls.push(['list']);
      if (failAuthOnce && logins === 1) {
        throw new Error('Authentication failed. Redirected back to login page.');
      }
      return { servers: list };
    },
    async manageServer(_cookies, serverId, task) {
      calls.push(['manage', serverId, task]);
      if (task === 'start') return startResult || { success: true, message: 'Action start performed successfully.' };
      if (task === 'stop') return stopResult || { success: true, message: 'Action stop performed successfully.' };
      if (task === 'info') return { address: 'play.example.aternos.me', port: '25565', software: 'Paper' };
      throw new Error(`unknown task ${task}`);
    },
  };
}

test('selectServer uses the only server or matches id/name', () => {
  assert.equal(selectServer(servers).id, 'abc');
  assert.equal(selectServer(servers, { serverId: 'abc' }).name, 'Survival');
  assert.equal(selectServer(servers, { serverName: 'survival' }).id, 'abc');
  assert.throws(() => selectServer([]), /No hay servidores/);
  assert.throws(
    () =>
      selectServer([
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
      ]),
    /ATERNOS_SERVER_ID/
  );
});

test('start logs in, picks the server and calls manageServer start', async () => {
  const api = mockApi();
  const controller = createAternosController({
    api,
    username: 'user',
    password: 'pass',
    cookieFile: '/tmp/mrstudios-aternos-cookies-test.json',
  });

  const result = await controller.start();
  assert.equal(result.success, true);
  assert.equal(result.server.name, 'Survival');
  assert.deepEqual(
    api.calls.map((call) => call[0]),
    ['login', 'list', 'manage'],
  );
  assert.equal(api.calls.at(-1)[2], 'start');
});

test('start skips manageServer when the server is already online', async () => {
  const api = mockApi({
    list: [{ id: 'abc', name: 'Survival', status: 'online' }],
  });
  const controller = createAternosController({
    api,
    username: 'user',
    password: 'pass',
    cookieFile: '/tmp/mrstudios-aternos-cookies-test.json',
  });

  const result = await controller.start();
  assert.equal(result.already, true);
  assert.equal(result.message, 'El servidor ya está en línea.');
  assert.equal(api.calls.some((call) => call[0] === 'manage'), false);
});

test('retries login after an expired session', async () => {
  const api = mockApi({ failAuthOnce: true });
  const controller = createAternosController({
    api,
    username: 'user',
    password: 'pass',
    cookieFile: '/tmp/mrstudios-aternos-cookies-test.json',
  });

  const result = await controller.status();
  assert.equal(result.success, true);
  assert.equal(result.info.address, 'play.example.aternos.me');
  assert.equal(api.calls.filter((call) => call[0] === 'login').length, 2);
});

test('stop calls manageServer stop', async () => {
  const api = mockApi({
    list: [{ id: 'abc', name: 'Survival', status: 'online' }],
  });
  const controller = createAternosController({
    api,
    username: 'user',
    password: 'pass',
    cookieFile: '/tmp/mrstudios-aternos-cookies-test.json',
  });

  const result = await controller.stop();
  assert.equal(result.success, true);
  assert.equal(api.calls.at(-1)[2], 'stop');
});
