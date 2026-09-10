import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildInboundReplyTriage,
  renderInboundReplyTriage
} from './lib/inbound-reply-triage.mjs';
import { buildInboundLeadPlan } from './lib/inbound-service-leads.mjs';

const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const PAID_PROMOTION_PATH = join('public', 'paid-promotion-ledger.json');
const SOCIAL_QUEUE_PATH = join('public', 'social-agent-content-queue.json');

const [, , command = 'plan', ...args] = process.argv;
const options = parseOptions(args);
const [queue, paidPromotionLedger, socialQueue] = await Promise.all([
  readJson(INBOUND_QUEUE_PATH),
  readJson(PAID_PROMOTION_PATH),
  readJson(SOCIAL_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
  case 'json':
    console.log(JSON.stringify(buildPlan(), null, 2));
    break;
  case 'triage':
    console.log(JSON.stringify(buildTriage(), null, 2));
    break;
  case 'markdown':
  case 'render':
    console.log(renderInboundReplyTriage(buildTriage()));
    break;
  default:
    throw new Error(`Unknown inbound reply triage command: ${command}. Use plan, triage, or markdown.`);
}

function buildPlan() {
  const leadPlan = buildInboundLeadPlan({ queue, paidPromotionLedger, socialQueue });
  return {
    project: queue.project,
    mode: 'inbound-reply-triage-plan',
    liveAttributionSources: leadPlan.liveAttributionSources.map((source) => ({
      ...source,
      triageCommand: `node scripts/inbound-reply-triage-agent.mjs markdown --sourceType ${source.type} --sourceId ${source.id} --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"`
    })),
    replyTemplates: queue.replyTemplates,
    nextAction:
      'When a reply or DM arrives, run the triage command before recording a lead or preparing invoice-review inputs.',
    boundary:
      'This planner does not contact leads, approve invoices, send payment instructions, grant tokens, control custody, or move assets.'
  };
}

function buildTriage() {
  return buildInboundReplyTriage({
    queue,
    sourceType: options.sourceType,
    sourceId: options.sourceId,
    contactHandle: options.contactHandle,
    publicProfileUrl: options.publicProfileUrl,
    projectUrl: options.projectUrl,
    offer: options.offer,
    replyText: options.replyText,
    evidence: options.evidence,
    recordedAtUtc: options.recordedAtUtc
  });
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}`);
    parsed[key.slice(2)] = collected.join(' ');
  }
  return parsed;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
