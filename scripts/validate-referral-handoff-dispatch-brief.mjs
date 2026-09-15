import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReferralHandoffDispatchBrief,
  renderReferralHandoffDispatchMarkdown
} from './referral-handoff-dispatch-brief-agent.mjs';

const queue = readJson(join('public', 'referral-partner-handoff-queue.json'));
const paidPromotionLedger = readJson(join('public', 'paid-promotion-ledger.json'));
const referralPartnerPolicy = readJson(join('public', 'referral-partner-policy.json'));
const inboundQueue = readJson(join('public', 'inbound-service-lead-queue.json'));
const packetArtifact = readOptionalJson(join('public', 'referral-partner-handoff-packet.json'));
const revenuePlan = readJson(join('public', 'revenue-operating-plan.json'));
const publicBrief = readOptionalJson(join('public', 'referral-handoff-dispatch-brief.json'));
const publicMarkdown = readOptionalText(join('public', 'referral-handoff-dispatch-brief.md'));
const agent = readFileSync(join('scripts', 'referral-handoff-dispatch-brief-agent.mjs'), 'utf8');
const packageJson = readJson('package.json');
const brief = buildReferralHandoffDispatchBrief({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  packetArtifact,
  revenuePlan,
  generatedAtUtc: publicBrief?.generatedAtUtc ?? '2026-09-10T13:00:00.000Z'
});
const markdown = renderReferralHandoffDispatchMarkdown(brief);
const findings = [];

if (brief.mode !== 'referral-handoff-manual-dispatch-brief') {
  findings.push('brief mode must be referral-handoff-manual-dispatch-brief');
}
if (!/does not send messages/i.test(brief.boundary ?? '')) {
  findings.push('boundary must say the brief does not send messages');
}
if (!/move assets/i.test(brief.boundary ?? '')) {
  findings.push('boundary must prohibit asset movement');
}
if (!/referral-handoff-evidence\.yml/.test(brief.evidenceIssueUrl ?? '')) {
  findings.push('brief must expose the referral handoff evidence issue form');
}
if (brief.totals.unrecordedHandoffCandidates > 0 && brief.readyManualHandoffs.length === 0) {
  findings.push('brief must expose ready handoff candidates when unrecorded candidates exist');
}
for (const item of brief.readyManualHandoffs) {
  if (!item.exactTerms || item.exactTerms !== packetFor(item)?.replyTemplate) {
    findings.push(`${item.sourceCampaignId}: exact terms must match the approved packet template`);
  }
  if (!/^[a-f0-9]{64}$/.test(item.approvedTermsSha256 ?? '')) {
    findings.push(`${item.sourceCampaignId}: approved terms SHA-256 must be exposed`);
  }
  if (item.reserveImpactPlanning?.basis !== 'planning-only') {
    findings.push(`${item.sourceCampaignId}: reserve impact must be planning-only`);
  }
  if (item.reserveImpactPlanning?.primaryOfferId !== revenuePlan.nextCycle?.primaryOfferId) {
    findings.push(`${item.sourceCampaignId}: primary offer must come from revenue operating plan`);
  }
  if (item.reserveImpactPlanning?.btcUsd !== revenuePlan.planningAssumptions?.btcUsd) {
    findings.push(`${item.sourceCampaignId}: planning BTC/USD must come from revenue operating plan`);
  }
  if (
    item.reserveImpactPlanning?.btcUsdSource !== revenuePlan.planningAssumptions?.btcUsdSource
  ) {
    findings.push(`${item.sourceCampaignId}: planning BTC/USD source must come from revenue operating plan`);
  }
  if (
    item.reserveImpactPlanning?.actualSatsRule !== revenuePlan.planningAssumptions?.actualSatsRule
  ) {
    findings.push(`${item.sourceCampaignId}: actual sats rule must come from revenue operating plan`);
  }
  if (!/referred customer pays/i.test(item.reserveImpactPlanning?.trigger ?? '')) {
    findings.push(`${item.sourceCampaignId}: reserve impact trigger must require a referred customer payment`);
  }
  if (!/confirmed/i.test(item.reserveImpactPlanning?.trigger ?? '')) {
    findings.push(`${item.sourceCampaignId}: reserve impact trigger must require confirmed receipt`);
  }
  if (!/chairman-approved/i.test(item.reserveImpactPlanning?.trigger ?? '')) {
    findings.push(`${item.sourceCampaignId}: reserve impact trigger must require chairman-approved allocation`);
  }
  if (item.reserveImpactPlanning?.primaryOfferReserveSats !== '174300') {
    findings.push(`${item.sourceCampaignId}: primary offer planning sats should be 174300 at current assumptions`);
  }
  if (item.reserveImpactPlanning?.qualifiedUpgradeReserveSats !== '699300') {
    findings.push(
      `${item.sourceCampaignId}: qualified upgrade planning sats should be 699300 at current assumptions`
    );
  }
  if (!item.recordSentCommand?.includes('--sentAtUtc "<sent-at-utc>"')) {
    findings.push(`${item.sourceCampaignId}: record sent command must require sentAtUtc`);
  }
  if (!item.recordSentCommand?.includes(`--messageHash ${item.approvedTermsSha256}`)) {
    findings.push(`${item.sourceCampaignId}: record sent command must require approved terms hash`);
  }
  if (!item.recordReferredLeadCommand?.includes('--sourceType manual-referral')) {
    findings.push(`${item.sourceCampaignId}: referred lead command must preserve manual-referral attribution`);
  }
  if (!/(no|do not offer) upfront/i.test(item.stopRule ?? '')) {
    findings.push(`${item.sourceCampaignId}: stop rule must block upfront compensation`);
  }
}
if (!markdown.includes('## Ready Manual Handoffs')) {
  findings.push('markdown must include ready manual handoffs section');
}
if (!markdown.includes('Approved terms SHA-256')) {
  findings.push('markdown must expose approved terms SHA-256');
}
if (!markdown.includes('Planning reserve impact: 174300 sats primary / 699300 sats qualified upgrade')) {
  findings.push('markdown must expose planning reserve impact for referral handoff conversion');
}
if (!markdown.includes('Planning BTC/USD source: operator planning assumption, not a live quote.')) {
  findings.push('markdown must expose planning BTC/USD source');
}
if (!markdown.includes('Counting rule: Count zero sats until a referred customer pays')) {
  findings.push('markdown must expose zero-sats counting rule before confirmed receipt');
}
if (!markdown.includes('referral-handoff-evidence.yml')) {
  findings.push('markdown must link evidence intake');
}
for (const command of markdown.match(/node scripts\/referral-partner-handoff-agent\.mjs record-sent[^\n]*/g) ?? []) {
  if (!/--messageHash [a-f0-9]{64}\b/.test(command)) {
    findings.push(`markdown record-sent command must require approved terms hash: ${command}`);
  }
}
if (/\b(private key|seed phrase)\b/i.test(markdown)) {
  findings.push('dispatch markdown must not include prohibited or secret-requesting language');
}
if (unsafePositiveClaimPattern().test(stripNegativeSafetyLanguage(markdown))) {
  findings.push('dispatch markdown must not promote prohibited operating language');
}
if (/recordReferralHandoffSent|record-sent/.test(agent.replace(/record-sent/g, 'record_sent_literal'))) {
  findings.push('dispatch agent must not import or execute referral handoff state mutation');
}
if (packageJson.scripts?.['ops:referral-handoff-dispatch-check'] !== 'node scripts/validate-referral-handoff-dispatch-brief.mjs') {
  findings.push('package.json must expose ops:referral-handoff-dispatch-check');
}
if (packageJson.scripts?.['ops:referral-handoff-dispatch-write'] !== 'node scripts/referral-handoff-dispatch-brief-agent.mjs write') {
  findings.push('package.json must expose ops:referral-handoff-dispatch-write');
}
if (publicBrief) {
  const expectedPublicBrief = buildReferralHandoffDispatchBrief({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    packetArtifact,
    revenuePlan,
    generatedAtUtc: publicBrief.generatedAtUtc
  });
  if (JSON.stringify(publicBrief) !== JSON.stringify(expectedPublicBrief)) {
    findings.push('public referral-handoff-dispatch-brief.json must match current generated brief');
  }
  if (
    publicMarkdown &&
    normalizeMarkdown(publicMarkdown) !==
      normalizeMarkdown(renderReferralHandoffDispatchMarkdown(publicBrief))
  ) {
    findings.push('public referral-handoff-dispatch-brief.md must match public JSON brief');
  }
}
if (publicMarkdown && !publicBrief) {
  findings.push('public referral-handoff-dispatch-brief.md requires matching JSON');
}

if (findings.length > 0) {
  console.error('Referral handoff dispatch brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Referral handoff dispatch brief check passed: post-receipt partner handoffs are copy-ready and hash-bound.'
);

function packetFor(item) {
  if (packetArtifact?.sourceCampaignId === item.sourceCampaignId) return packetArtifact.packet;
  return null;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function readOptionalText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function stripNegativeSafetyLanguage(text) {
  return String(text ?? '').replace(
    /\b(no|not|without|do not|does not|must not|cannot|block(?:s)?|prohibit(?:s)?|before separate Executive Chairman approval)[^.\n]*(?:upfront compensation|payment instructions|token grants|public posts|invoices|guaranteed results|market support|price or buyer claims|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support commitment|asset movement)[^.\n]*/gi,
    ''
  );
}

function unsafePositiveClaimPattern() {
  return /\b(guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market support|market-support commitment)\b/i;
}

function normalizeMarkdown(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}
