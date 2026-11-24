import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SEARCH_NAMES = [
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
  'chrome',
];

const SEARCH_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/local/bin/google-chrome',
];

function which(command) {
  try {
    return execFileSync('which', [command], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function resolveChromiumExecutable(env = process.env) {
  const fromEnv = env.CHROMIUM_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  for (const name of SEARCH_NAMES) {
    const found = which(name);
    if (found) {
      return found;
    }
  }

  return SEARCH_PATHS.find((file) => fs.existsSync(file)) || '';
}

export function ensureChromiumOnPath(env = process.env) {
  if (which('chromium')) {
    return which('chromium');
  }

  const executable = resolveChromiumExecutable(env);
  if (!executable) {
    throw new Error(
      'No se encontró Chromium. El cliente no oficial de Aternos lo necesita. En Ubuntu: sudo apt-get install -y chromium (o define CHROMIUM_PATH).',
    );
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrstudios-chromium-'));
  fs.symlinkSync(executable, path.join(dir, 'chromium'));
  env.PATH = `${dir}${path.delimiter}${env.PATH || ''}`;
  process.env.PATH = env.PATH;
  return executable;
}
