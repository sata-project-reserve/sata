import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const approvalAgent = readFileSync(join('scripts', 'executive-approval-agent.mjs'), 'utf8');
const terminalNotifier = readFileSync(join('scripts', 'codex-terminal-notifier.mjs'), 'utf8');
const approvalSupervisor = readFileSync(join('scripts', 'codex-approval-supervisor.mjs'), 'utf8');
const envExample = readFileSync('.env.example', 'utf8');
const runbook = readFileSync(join('docs', 'executive-approval-runbook.md'), 'utf8');
const terminalDocs = readFileSync(join('docs', 'codex-terminal-notifications.md'), 'utf8');
const findings = [];

for (const channel of ['ntfy', 'email', 'whatsapp', 'sms']) {
  if (!approvalAgent.includes(`'${channel}'`) && !approvalAgent.includes(`"${channel}"`)) {
    findings.push(`executive approval notifier missing channel ${channel}`);
  }
}

const ntfyFunction = extractFunction('sendNtfy', approvalAgent);
if (!/if \(testMode\)[\s\S]+notificationId: 'test-mode'/.test(ntfyFunction)) {
  findings.push('ntfy notifier must return in test mode without sending');
}
if (ntfyFunction.indexOf('if (testMode)') > ntfyFunction.indexOf('await fetch(')) {
  findings.push('ntfy test-mode guard must run before fetch');
}
if (!/EXECUTIVE_APPROVAL_CHANNEL=ntfy/.test(envExample)) {
  findings.push('.env.example must default executive approvals to ntfy');
}
for (const requiredEnv of ['NTFY_TOPIC', 'EXECUTIVE_APPROVAL_EMAIL', 'SMTP_HOST', 'SMTP_USER']) {
  if (!envExample.includes(requiredEnv)) findings.push(`.env.example missing ${requiredEnv}`);
}
if (!/without sending a\s+message/i.test(runbook)) {
  findings.push('executive approval runbook must state notify:test does not send');
}
if (!terminalNotifier.includes("await mkdir(dirname(REGISTRY_PATH), { recursive: true })")) {
  findings.push('codex terminal notifier must write registry under its repo-root artifacts directory');
}
if (!/collected\.join\(' '\)/.test(terminalNotifier)) {
  findings.push('codex terminal notifier parser must preserve multi-word values');
}
if (!/Topic names like secrets|Treat topic names like secrets/i.test(terminalDocs)) {
  findings.push('codex terminal notification docs must warn that topics are secret-like');
}
for (const requiredSupervisorText of [
  'SAFE_NPM_SCRIPTS',
  'needs-chairman-attention',
  'normalizeCwd',
  'cwd must stay inside',
  'unsupported executable',
  'unknown installs',
  'wallet actions'
]) {
  if (!approvalSupervisor.includes(requiredSupervisorText) && !terminalDocs.includes(requiredSupervisorText)) {
    findings.push(`approval supervisor missing boundary text: ${requiredSupervisorText}`);
  }
}
if (!/execFileSync\([\s\S]+stdio: \['ignore', 'pipe', 'pipe'\]/.test(approvalSupervisor)) {
  findings.push('approval supervisor must execute safe commands with execFileSync and without shell');
}
if (/shell:\s*true/.test(approvalSupervisor)) {
  findings.push('approval supervisor must not execute requests through a shell');
}
if (!/codex:approval:submit/.test(readFileSync('package.json', 'utf8'))) {
  findings.push('package.json missing codex approval queue scripts');
}

if (findings.length > 0) {
  console.error('Notification tools check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Notification tools check passed: executive and Codex terminal notifier boundaries are enforceable.');

function extractFunction(name, source) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) return '';
  const nextFunction = source.indexOf('\nasync function ', start + 1);
  const nextPlainFunction = source.indexOf('\nfunction ', start + 1);
  const candidates = [nextFunction, nextPlainFunction].filter((index) => index > start);
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}
