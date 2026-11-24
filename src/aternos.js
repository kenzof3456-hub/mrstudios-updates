import fs from 'node:fs';
import path from 'node:path';
import { sanitizeClientMessage } from './messages.js';

const DEFAULT_COOKIE_FILE = path.resolve(process.cwd(), 'aternos-cookies.json');

function isAuthError(err) {
  const message = String(err?.message || err);
  return /auth/i.test(message) || /login/i.test(message) || /redirected back to login/i.test(message);
}

export function selectServer(servers, { serverId, serverName } = {}) {
  if (!Array.isArray(servers) || servers.length === 0) {
    throw new Error('No hay servidores en esta cuenta de Aternos.');
  }

  if (serverId) {
    const match = servers.find((server) => server.id === serverId);
    if (!match) {
      throw new Error(`No se encontró el servidor con ID ${serverId}.`);
    }
    return match;
  }

  if (serverName) {
    const wanted = serverName.toLowerCase();
    const match = servers.find((server) => (server.name || '').toLowerCase() === wanted);
    if (!match) {
      throw new Error(`No se encontró el servidor llamado "${serverName}".`);
    }
    return match;
  }

  if (servers.length === 1) {
    return servers[0];
  }

  const available = servers
    .map((server) => `${server.name || 'sin nombre'} (${server.id || 'sin id'})`)
    .join(', ');
  throw new Error(
    `Hay varios servidores. Define ATERNOS_SERVER_ID o ATERNOS_SERVER_NAME. Disponibles: ${available}`,
  );
}

export function createAternosController({
  api,
  username,
  password,
  serverId,
  serverName,
  cookieFile = DEFAULT_COOKIE_FILE,
} = {}) {
  if (!api?.loginToAternos || !api?.getServerList || !api?.manageServer) {
    throw new Error('Se necesita un cliente no oficial de Aternos (loginToAternos, getServerList, manageServer).');
  }

  let cookies = null;
  let queue = Promise.resolve();

  function enqueue(work) {
    const run = queue.then(work, work);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function clearCookieFile() {
    try {
      fs.unlinkSync(cookieFile);
    } catch {
      // The unofficial client creates this file on login; missing is fine.
    }
    cookies = null;
  }

  async function login(force = false) {
    if (force) {
      clearCookieFile();
    }
    if (cookies) {
      return cookies;
    }
    cookies = await api.loginToAternos(username, password);
    return cookies;
  }

  async function withAuth(fn) {
    try {
      return await fn(await login());
    } catch (err) {
      if (!isAuthError(err)) {
        throw err;
      }
      return fn(await login(true));
    }
  }

  async function listServers() {
    const result = await withAuth((session) => api.getServerList(session));
    return result?.servers || [];
  }

  function outcome(action, success, server, extra = {}) {
    return {
      action,
      success,
      server,
      message: sanitizeClientMessage(extra.message),
      already: Boolean(extra.already),
      info: extra.info || null,
      result: extra.result || null,
    };
  }

  return {
    start() {
      return enqueue(async () => {
        const servers = await listServers();
        const server = selectServer(servers, { serverId, serverName });
        const status = String(server.status || '').toLowerCase();

        if (status === 'online') {
          return outcome('start', true, server, {
            already: true,
            message: 'El servidor ya está en línea.',
          });
        }

        const result = await withAuth((session) => api.manageServer(session, server.id, 'start'));
        return outcome('start', result?.success !== false, server, {
          message: result?.message || 'Se pidió encender el servidor.',
          result,
        });
      });
    },

    stop() {
      return enqueue(async () => {
        const servers = await listServers();
        const server = selectServer(servers, { serverId, serverName });
        const status = String(server.status || '').toLowerCase();

        if (status === 'offline') {
          return outcome('stop', true, server, {
            already: true,
            message: 'El servidor ya está apagado.',
          });
        }

        const result = await withAuth((session) => api.manageServer(session, server.id, 'stop'));
        return outcome('stop', result?.success !== false, server, {
          message: result?.message || 'Se pidió apagar el servidor.',
          result,
        });
      });
    },

    status() {
      return enqueue(async () => {
        const servers = await listServers();
        const server = selectServer(servers, { serverId, serverName });
        let info = null;
        try {
          info = await withAuth((session) => api.manageServer(session, server.id, 'info'));
        } catch {
          info = null;
        }
        return outcome('status', true, server, { info });
      });
    },
  };
}
