import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const queuePath = join('public', 'executive-approval-queue.json');
const queue = JSON.parse(readFileSync(queuePath, 'utf8'));

const allowedModes = ['executive-chairman-final-approval'];
const allowedCategories = [
  'operations',
  'social-post',
  'promoter-offer',
  'paid-promotion',
  'token-compensation',
  'revenue-action',
  'treasury-action',
  'liquidity-action',
  'roadmap-proposal',
  'partnership',
  'legal',
  'security',
  'wallet-custody'
];
const allowedStatuses = [
  'draft',
  'ready-for-chairman-review',
  'approved-by-chairman',
  'rejected',
  'executed',
  'superseded'
];
const allowedExecutionModes = [
  'no-execution',
  'manual-chairman-action',
  'approved-agent-non-custodial-action',
  'signed-transaction-preview'
];
const sensitiveCategories = new Set([
  'treasury-action',
  'liquidity-action',
  'token-compensation',
  'revenue-action',
  'paid-promotion',
  'promoter-offer',
  'partnership',
  'legal',
  'security',
  'wallet-custody'
]);

const forbiddenPatterns = [
  { name: 'secret material', pattern: /\b(seed phrase|secret recovery phrase|private key)\b/i },
  { name: 'signed transaction bytes', pattern: /\bsigned transaction\b|\bsignature bytes\b/i },
  { name: 'price guarantee', pattern: /\bguaranteed (price|return|profit|upside|gain|yield)\b/i },
  { name: 'risk free', pattern: /\brisk[- ]?free\b/i },
  { name: 'redemption promise', pattern: /\bredeemable\b|\bredemption guarantee\b/i },
  { name: 'pump language', pattern: /\bpump\b|\bmoon\b|\b100x\b|\braid\b/i },
  { name: 'coordinated trading', pattern: /\bcoordinated buy\b|\bwash trading\b/i }
];

const findings = [];

if (!allowedModes.includes(queue.mode)) {
  findings.push(`queue.mode must be one of: ${allowedModes.join(', ')}`);
}
if (queue.schemaVersion !== 1) {
  findings.push('queue.schemaVersion must be 1');
}
if (queue.executiveChairman?.role !== 'Executive Chairman') {
  findings.push('executiveChairman.role must be Executive Chairman');
}
if (!Array.isArray(queue.items)) {
  findings.push('queue.items must be an array');
}

const ids = new Set();
for (const item of queue.items ?? []) {
  validateItem(item);
}

if (findings.length > 0) {
  console.error('Executive approval queue check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Executive approval queue check passed: proposal gates are enforceable.');

function validateItem(item) {
  const label = item?.id ?? '<missing-id>';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item?.id ?? '')) {
    findings.push(`${label}: id must be kebab-case`);
  }
  if (ids.has(item.id)) {
    findings.push(`${label}: duplicate id`);
  }
  ids.add(item.id);

  for (const field of [
    'title',
    'category',
    'status',
    'createdAtUtc',
    'preparedBy',
    'summary',
    'rationale',
    'proposedAction',
    'execution',
    'publicDisclosure'
  ]) {
    if (!item[field] || typeof item[field] !== 'string') {
      findings.push(`${label}: missing string field ${field}`);
    }
  }
  if (!allowedCategories.includes(item.category)) {
    findings.push(`${label}: unsupported category ${item.category}`);
  }
  if (!allowedStatuses.includes(item.status)) {
    findings.push(`${label}: unsupported status ${item.status}`);
  }
  if (!allowedExecutionModes.includes(item.execution)) {
    findings.push(`${label}: unsupported execution mode ${item.execution}`);
  }
  if (!Array.isArray(item.riskReview) || item.riskReview.length === 0) {
    findings.push(`${label}: riskReview must include at least one risk control`);
  }
  if (!Array.isArray(item.evidence)) {
    findings.push(`${label}: evidence must be an array`);
  }
  if (sensitiveCategories.has(item.category) && item.requiredChairmanApproval !== true) {
    findings.push(`${label}: sensitive category requires chairman approval`);
  }
  if (
    ['approved-by-chairman', 'executed'].includes(item.status) &&
    (item.approvedBy !== 'executive-chairman' || !item.approvedAtUtc)
  ) {
    findings.push(`${label}: approved/executed items require approvedBy and approvedAtUtc`);
  }
  if (item.status === 'executed' && (!item.executedAtUtc || item.evidence.length === 0)) {
    findings.push(`${label}: executed items require executedAtUtc and evidence`);
  }
  if (
    ['paid-promotion', 'promoter-offer', 'token-compensation'].includes(item.category) &&
    !/Sponsored|Paid Partnership|token-compensated/i.test(item.publicDisclosure)
  ) {
    findings.push(`${label}: paid/token promotion disclosure must be explicit`);
  }

  const searchable = JSON.stringify(item);
  for (const { name, pattern } of forbiddenPatterns) {
    const disclosureAllows =
      (name === 'redemption promise' &&
        /not a redemption promise|no redemption promise/i.test(item.publicDisclosure)) ||
      (name === 'price guarantee' &&
        /not .*guaranteed price floor|no price guarantee/i.test(item.publicDisclosure)) ||
      (name === 'pump language' &&
        /reject .*pump language|no .*pump language/i.test(searchable)) ||
      (name === 'coordinated trading' &&
        /no .*wash trading|reject .*wash trading|no .*coordinated trading|reject .*coordinated trading/i.test(
          searchable
        ));
    if (pattern.test(searchable) && !disclosureAllows) {
      findings.push(`${label}: matched forbidden wording ${name}`);
    }
  }
}
