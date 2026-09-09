import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const nextEnvFile = path.join(rootDir, 'next-env.d.ts');
const playwrightBin = path.join(rootDir, 'node_modules', '@playwright', 'test', 'cli.js');
const port = process.env.PLAYWRIGHT_PORT ?? '3001';
const baseUrl = `http://127.0.0.1:${port}`;
const args = process.argv.slice(2);

let server;
let shuttingDown = false;

function spawnNode(script, scriptArgs, extraEnv = {}) {
  return spawn(process.execPath, [script, ...scriptArgs], {
    cwd: rootDir,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    windowsHide: true
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(2_000)
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${baseUrl}: ${lastError?.message ?? 'no response'}`);
}

function killProcessTree(child) {
  if (!child?.pid) {
    return Promise.resolve();
  }

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      });
      killer.once('exit', () => resolve());
      killer.once('error', () => resolve());
    });
  }

  child.kill('SIGTERM');
  return Promise.resolve();
}

async function restoreNextEnvTypesImport() {
  await writeFile(
    nextEnvFile,
    [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      'import "./.next/types/routes.d.ts";',
      '',
      '// NOTE: This file should not be edited',
      '// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.',
      ''
    ].join('\n')
  );
}

async function cleanup() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await killProcessTree(server);
  await restoreNextEnvTypesImport();
}

async function shutdownWithSignal(exitCode) {
  await cleanup();
  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdownWithSignal(130));
process.on('SIGTERM', () => void shutdownWithSignal(143));

try {
  server = spawnNode(nextBin, ['dev', '-p', port], {
    PLAYWRIGHT_BASE_URL: baseUrl
  });

  server.once('exit', (code) => {
    if (!shuttingDown) {
      console.error(`Next dev server exited before tests completed with code ${code ?? 0}.`);
      process.exit(code ?? 1);
    }
  });

  await waitForServer();

  const testRunner = spawnNode(playwrightBin, ['test', ...args], {
    PLAYWRIGHT_BASE_URL: baseUrl,
    SATA_PLAYWRIGHT_EXTERNAL_SERVER: 'true'
  });

  const exitCode = await new Promise((resolve) => {
    testRunner.once('exit', (code) => resolve(code ?? 0));
    testRunner.once('error', (error) => {
      console.error(error);
      resolve(1);
    });
  });

  await cleanup();
  process.exit(exitCode);
} catch (error) {
  console.error(error);
  await cleanup();
  process.exit(1);
}
