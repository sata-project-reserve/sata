import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REQUEST_ROOT = join(REPO_ROOT, 'artifacts', 'codex-approval-requests');
const PENDING_DIR = join(REQUEST_ROOT, 'pending');
const DONE_DIR = join(REQUEST_ROOT, 'done');
const ATTENTION_DIR = join(REQUEST_ROOT, 'attention');
const TOPIC_REGISTRY_PATH = join(REPO_ROOT, 'artifacts', 'codex-terminal-topics.json');
const SAFE_NPM_SCRIPTS = new Set([
  'build',
  'codex:notify:list',
  'format',
  'lint',
  'ops:approval-followthrough-check',
  'ops:approval-followthrough-plan',
  'ops:approval-plan-check',
  'ops:autopilot-check',
  'ops:audit-artifact-check',
  'ops:audit-artifact-plan',
  'ops:check',
  'ops:cycle-check',
  'ops:cycle-plan',
  'ops:delivery-check',
  'ops:delivery-plan',
  'ops:intake-check',
  'ops:intake-comment-check',
  'ops:intake-plan',
  'ops:invoice-check',
  'ops:invoice-payment-check',
  'ops:invoice-payment-plan',
  'ops:invoice-plan',
  'ops:invoice-quote-check',
  'ops:invoice-quote-plan',
  'ops:invoice-request-check',
  'ops:invoice-request-plan',
  'ops:notification-check',
  'ops:outreach-check',
  'ops:outreach-dispatch-check',
  'ops:outreach-dispatch-plan',
  'ops:outreach-plan',
  'ops:outreach-approval-check',
  'ops:outreach-approval-plan',
  'ops:paid-promotion-check',
  'ops:paid-promotion-plan',
  'ops:plan',
  'ops:prospect-candidate-check',
  'ops:prospect-candidate-plan',
  'ops:prospect-check',
  'ops:prospect-follow-up-check',
  'ops:prospect-follow-up-plan',
  'ops:prospect-intake-check',
  'ops:prospect-intake-comment-check',
  'ops:prospect-intake-plan',
  'ops:prospect-plan',
  'ops:prospect-response-check',
  'ops:prospect-response-plan',
  'ops:prospect-review-check',
  'ops:prospect-review-plan',
  'ops:prospect-stage-check',
  'ops:prospect-stage-plan',
  'ops:receipt-check',
  'ops:receipt-plan',
  'ops:reserve-check',
  'ops:reserve-plan',
  'ops:revenue-check',
  'ops:revenue-plan',
  'ops:sats-check',
  'ops:sats-plan',
  'security:check',
  'social:check',
  'test',
  'test:e2e',
  'typecheck',
  'verify:devnet'
]);

const [, , command = 'help', ...args] = process.argv;
loadLocalEnv();

switch (command) {
  case 'submit':
    await submitRequest(parseArgs(args));
    break;
  case 'process':
    await processPendingRequests({ dryRun: args.includes('--dry-run') });
    break;
  case 'watch':
    await watchPendingRequests(parseArgs(args));
    break;
  case 'list':
    await listRequests();
    break;
  case 'help':
  default:
    printHelp();
    break;
}

async function submitRequest(options) {
  if (!options.command) throw new Error('Missing --command.');
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
  const request = {
    id,
    createdAtUtc: new Date().toISOString(),
    label: options.label ?? 'codex-terminal',
    cwd: options.cwd ?? REPO_ROOT,
    command: options.command,
    reason: options.reason ?? '',
    topic: options.topic ?? null,
    status: 'pending'
  };

  await mkdir(PENDING_DIR, { recursive: true });
  const path = join(PENDING_DIR, `${id}.json`);
  await writeFile(path, `${JSON.stringify(request, null, 2)}\n`);
  console.log(JSON.stringify({ submitted: id, path }, null, 2));
}

async function processPendingRequests({ dryRun }) {
  await mkdir(PENDING_DIR, { recursive: true });
  await mkdir(DONE_DIR, { recursive: true });
  await mkdir(ATTENTION_DIR, { recursive: true });

  const files = (await readdir(PENDING_DIR)).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('No pending Codex approval requests.');
    return;
  }

  for (const file of files) {
    const sourcePath = join(PENDING_DIR, file);
    const request = JSON.parse(await readFile(sourcePath, 'utf8'));
    const classification = classifyRequest(request);
    if (!classification.safe) {
      if (dryRun) {
        console.log(`${request.id}: would request attention - ${classification.reason}`);
        continue;
      }
      await moveWithResult({
        sourcePath,
        targetDir: ATTENTION_DIR,
        request,
        result: {
          status: 'needs-chairman-attention',
          reason: classification.reason,
          processedAtUtc: new Date().toISOString()
        }
      });
      await notifyAttention(request, classification.reason);
      console.log(`${request.id}: needs attention - ${classification.reason}`);
      continue;
    }

    if (dryRun) {
      console.log(
        `${request.id}: would run ${classification.command} ${classification.args.join(' ')}`
      );
      continue;
    }

    const result = runSafeAction(classification, request);
    await moveWithResult({
      sourcePath,
      targetDir: DONE_DIR,
      request,
      result: {
        status: result.ok ? 'executed' : 'failed',
        safeAction: classification.label,
        exitCode: result.exitCode,
        stdout: trimOutput(result.stdout),
        stderr: trimOutput(result.stderr),
        processedAtUtc: new Date().toISOString()
      }
    });
    console.log(`${request.id}: ${result.ok ? 'executed' : 'failed'} ${classification.label}`);
    if (!result.ok) {
      await notifyAttention(request, `Safe command failed: ${classification.label}`);
    }
  }
}

async function watchPendingRequests(options) {
  const intervalMs = parsePositiveInteger(options.intervalMs ?? '10000', '--interval-ms');
  console.log(`Watching Codex approval requests every ${intervalMs}ms. Press Ctrl+C to stop.`);
  while (true) {
    await processPendingRequests({ dryRun: false });
    await delay(intervalMs);
  }
}

async function listRequests() {
  for (const [status, dir] of [
    ['pending', PENDING_DIR],
    ['attention', ATTENTION_DIR],
    ['done', DONE_DIR]
  ]) {
    const files = existsSync(dir)
      ? (await readdir(dir)).filter((file) => file.endsWith('.json'))
      : [];
    console.log(JSON.stringify({ status, count: files.length, files }, null, 2));
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1000) {
    throw new Error(`${label} must be an integer of at least 1000.`);
  }
  return parsed;
}

function classifyRequest(request) {
  const cwd = normalizeCwd(request.cwd);
  const tokens = unwrapShell(tokenizeCommand(request.command ?? ''));
  if (tokens.length === 0) return unsafe('empty command');

  const executable = executableName(tokens[0]);
  if (executable === 'git') return classifyGit(tokens, cwd);
  if (executable === 'npm') return classifyNpm(tokens, cwd);
  if (executable === 'node') return classifyNode(tokens, cwd);
  return unsafe(`unsupported executable: ${tokens[0]}`);
}

function classifyGit(tokens, cwd) {
  let index = 1;
  while (tokens[index] === '-c' && tokens[index + 1]?.startsWith('safe.directory=')) index += 2;
  if (tokens[index] === '-C') index += 2;

  const subcommand = tokens[index];
  const rest = tokens.slice(index + 1);
  if (subcommand === 'commit') {
    const messageIndex = rest.findIndex((token) => token === '-m' || token === '--message');
    const message = messageIndex === -1 ? null : rest[messageIndex + 1];
    const unsupported = rest.filter((token, restIndex) => {
      if (restIndex === messageIndex || restIndex === messageIndex + 1) return false;
      return !['--no-verify'].includes(token);
    });
    if (!message) return unsafe('git commit requires -m/--message');
    if (unsupported.length > 0)
      return unsafe(`unsupported git commit args: ${unsupported.join(' ')}`);
    return safe('git commit', 'git', ['-C', cwd, 'commit', '-m', message]);
  }
  if (subcommand === 'status') {
    return safe('git status', 'git', ['-C', cwd, 'status', ...rest]);
  }
  if (subcommand === 'diff' && !rest.some((token) => token.startsWith('--output'))) {
    return safe('git diff', 'git', ['-C', cwd, 'diff', ...rest]);
  }
  return unsafe(`unsupported git subcommand: ${subcommand}`);
}

function classifyNpm(tokens, cwd) {
  if (tokens[1] !== 'run') return unsafe('only npm run is allowlisted');
  const script = tokens[2];
  if (!SAFE_NPM_SCRIPTS.has(script)) return unsafe(`npm script is not allowlisted: ${script}`);
  const args = ['run', script, ...tokens.slice(3)];
  return safe(`npm run ${script}`, 'npm', args, cwd);
}

function classifyNode(tokens, cwd) {
  const script = tokens[1];
  if (!script?.startsWith('scripts\\') && !script?.startsWith('scripts/')) {
    return unsafe('node command must target scripts/');
  }
  const normalizedScript = script.replace(/\\/g, '/');
  const scriptName = basename(normalizedScript);
  const scriptArgs = tokens.slice(2);
  const planLike = ['plan', 'status', 'list', 'notify-test', 'help'].includes(
    scriptArgs[0] ?? 'help'
  );
  const validateScript = /^validate-[a-z0-9-]+\.mjs$/.test(scriptName);
  const allowedUtility =
    scriptName === 'codex-terminal-notifier.mjs' && ['list', 'help'].includes(scriptArgs[0]);
  if (!validateScript && !planLike && !allowedUtility) {
    return unsafe(`node script is not allowlisted for supervisor execution: ${scriptName}`);
  }
  return safe(`node ${normalizedScript}`, 'node', [normalizedScript, ...scriptArgs], cwd);
}

function runSafeAction(classification, request) {
  try {
    const stdout = execFileSync(classification.command, classification.args, {
      cwd: classification.cwd,
      encoding: 'utf8',
      timeout: Number(request.timeoutMs ?? 600000),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      ok: false,
      exitCode: error.status ?? 1,
      stdout: error.stdout?.toString?.() ?? '',
      stderr: error.stderr?.toString?.() ?? error.message
    };
  }
}

async function moveWithResult({ sourcePath, targetDir, request, result }) {
  const targetPath = join(targetDir, basename(sourcePath));
  await writeFile(sourcePath, `${JSON.stringify({ ...request, result }, null, 2)}\n`);
  await rename(sourcePath, targetPath);
}

async function notifyAttention(request, reason) {
  const target = await resolveNtfyTarget(request);
  if (!target.topic) {
    console.log(`${request.id}: ntfy not configured; cannot push attention notice.`);
    return;
  }
  const response = await fetch(`${target.server}/${encodeURIComponent(target.topic)}`, {
    method: 'POST',
    headers: {
      Title: `Codex approval needed: ${request.label ?? request.id}`,
      Priority: 'urgent',
      Tags: 'warning'
    },
    body: [
      reason,
      '',
      `Command: ${request.command ?? '<missing>'}`,
      request.reason ? `Reason: ${request.reason}` : null,
      `Request: ${request.id}`
    ]
      .filter(Boolean)
      .join('\n')
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.log(`${request.id}: ntfy publish failed ${response.status} ${text}`);
  }
}

async function resolveNtfyTarget(request) {
  const server = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(/\/+$/, '');
  if (request.topic) return { server, topic: request.topic };
  if (process.env.NTFY_TOPIC) return { server, topic: process.env.NTFY_TOPIC };
  try {
    const registry = JSON.parse(await readFile(TOPIC_REGISTRY_PATH, 'utf8'));
    const entry = (registry.topics ?? []).find((topic) => topic.label === request.label);
    return { server: (registry.server ?? server).replace(/\/+$/, ''), topic: entry?.topic ?? null };
  } catch (error) {
    if (error.code === 'ENOENT') return { server, topic: null };
    throw error;
  }
}

function normalizeCwd(value) {
  const cwd = resolve(value ?? REPO_ROOT);
  const root = resolve(REPO_ROOT);
  if (cwd !== root && !cwd.startsWith(`${root}\\`) && !cwd.startsWith(`${root}/`)) {
    throw new Error(`cwd must stay inside ${REPO_ROOT}: ${cwd}`);
  }
  return cwd;
}

function safe(label, command, args, cwd = REPO_ROOT) {
  return { safe: true, label, command, args, cwd };
}

function unsafe(reason) {
  return { safe: false, reason };
}

function executableName(value) {
  return basename(value)
    .toLowerCase()
    .replace(/\.(exe|cmd)$/i, '');
}

function unwrapShell(tokens) {
  const executable = executableName(tokens[0] ?? '');
  if ((executable === 'cmd' || executable === 'cmd.exe') && tokens[1]?.toLowerCase() === '/c') {
    return unwrapShell(tokenizeCommand(tokens.slice(2).join(' ')));
  }
  return tokens;
}

function tokenizeCommand(commandText) {
  const tokens = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < commandText.length; index += 1) {
    const char = commandText[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseArgs(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}.`);
    options[toCamelCase(key.slice(2))] = collected.join(' ');
  }
  return options;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function trimOutput(value) {
  const text = value ?? '';
  return text.length > 4000 ? `${text.slice(0, 4000)}\n...[truncated]` : text;
}

function loadLocalEnv() {
  for (const envPath of [join(REPO_ROOT, '.env.local'), join(REPO_ROOT, '.env')]) {
    try {
      const contents = readFileSync(envPath, 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        const rawValue = trimmed.slice(separator + 1).trim();
        if (!key || process.env[key] !== undefined) continue;
        process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/codex-approval-supervisor.mjs submit --label codex-terminal-1 --command "git commit -m message" --reason "Codex is waiting"
  node scripts/codex-approval-supervisor.mjs process
  node scripts/codex-approval-supervisor.mjs process --dry-run
  node scripts/codex-approval-supervisor.mjs watch --interval-ms 10000
  node scripts/codex-approval-supervisor.mjs list`);
}
