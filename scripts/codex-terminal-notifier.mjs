import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REGISTRY_PATH = join(REPO_ROOT, 'artifacts', 'codex-terminal-topics.json');
const DEFAULT_SERVER = 'https://ntfy.sh';
const [, , command = 'help', ...args] = process.argv;

switch (command) {
  case 'init':
    await initTopics(Number(args[0] ?? 4));
    break;
  case 'list':
    await listTopics();
    break;
  case 'send':
    await sendFromArgs(args);
    break;
  case 'help':
  default:
    printHelp();
    break;
}

async function initTopics(count) {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('Topic count must be an integer from 1 to 20.');
  }

  const registry = await readRegistry();
  registry.server = registry.server ?? DEFAULT_SERVER;
  registry.createdAtUtc = registry.createdAtUtc ?? new Date().toISOString();
  registry.topics = registry.topics ?? [];

  for (let index = registry.topics.length + 1; index <= count; index += 1) {
    registry.topics.push({
      label: `codex-terminal-${index}`,
      topic: `codex-${slug(os.hostname())}-${index}-${randomBytes(8).toString('hex')}`,
      createdAtUtc: new Date().toISOString()
    });
  }

  await writeRegistry(registry);
  printRegistry(registry);
}

async function listTopics() {
  printRegistry(await readRegistry());
}

async function sendFromArgs(args) {
  const options = parseArgs(args);
  const registry = await readRegistry();
  const entry = findTopic(registry, options.label);
  const server = (options.server ?? registry.server ?? DEFAULT_SERVER).replace(/\/+$/, '');
  const topic = options.topic ?? entry?.topic;
  const title = options.title ?? `Codex attention: ${options.label ?? entry?.label ?? 'terminal'}`;
  const message = options.message;

  if (!topic) throw new Error('Missing topic. Pass --topic or --label from the registry.');
  if (!message) throw new Error('Missing message. Pass --message "text".');

  const response = await fetch(`${server}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers: {
      Title: title,
      Priority: options.priority ?? 'high',
      Tags: options.tags ?? 'warning'
    },
    body: message
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`ntfy failed: ${result.error ?? result.message ?? response.status}`);
  }

  console.log(
    JSON.stringify(
      {
        provider: 'ntfy',
        label: options.label ?? entry?.label ?? null,
        topic,
        notificationId: result.id ?? null
      },
      null,
      2
    )
  );
}

function findTopic(registry, label) {
  if (!label) return null;
  return (registry.topics ?? []).find((entry) => entry.label === label) ?? null;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const collected = [];
    while (args[index + 1] && !args[index + 1].startsWith('--')) {
      collected.push(args[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for --${key}`);
    options[toCamelCase(key)] = collected.join(' ');
  }
  return options;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

async function readRegistry() {
  try {
    return JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeRegistry(registry) {
  await mkdir(dirname(REGISTRY_PATH), { recursive: true });
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
}

function printRegistry(registry) {
  console.log(
    JSON.stringify(
      {
        registryPath: REGISTRY_PATH,
        server: registry.server ?? DEFAULT_SERVER,
        topics: registry.topics ?? []
      },
      null,
      2
    )
  );
}

function printHelp() {
  console.log(`Usage:
  node scripts/codex-terminal-notifier.mjs init [count]
  node scripts/codex-terminal-notifier.mjs list
  node scripts/codex-terminal-notifier.mjs send --label codex-terminal-1 --message "Needs approval"
  node scripts/codex-terminal-notifier.mjs send --topic topic-name --message "Needs approval"`);
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
