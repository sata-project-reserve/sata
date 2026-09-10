import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSettlementOptionsBrief,
  renderSettlementOptionsMarkdown
} from './settlement-options-brief-agent.mjs';

const status = readJson(join('public', 'revenue-cycle-status.json'));
const revenuePlan = readJson(join('public', 'revenue-operating-plan.json'));
const invoiceQueue = readJson(join('public', 'sats-invoice-queue.json'));
const report = readJson(join('public', 'transparency', 'latest.json'));
const publicBrief = readOptionalJson(join('public', 'settlement-options-brief.json'));
const publicMarkdown = readOptionalText(join('public', 'settlement-options-brief.md'));
const agent = readFileSync(join('scripts', 'settlement-options-brief-agent.mjs'), 'utf8');
const packageJson = readJson('package.json');
const brief = buildSettlementOptionsBrief({
  status,
  revenuePlan,
  invoiceQueue,
  report,
  generatedAtUtc: publicBrief?.generatedAtUtc ?? '2026-09-10T17:15:00.000Z'
});
const markdown = renderSettlementOptionsMarkdown(brief);
const findings = [];

if (brief.mode !== 'chairman-gated-settlement-options-brief') {
  findings.push('brief mode must be chairman-gated-settlement-options-brief');
}
if (!/does not approve invoices/i.test(brief.boundary ?? '')) {
  findings.push('boundary must say the brief does not approve invoices');
}
if (!/move assets/i.test(brief.boundary ?? '')) {
  findings.push('boundary must prohibit asset movement');
}
if (brief.directReservePath.settlementCurrency !== 'BTC') {
  findings.push('direct reserve path must be BTC');
}
if (!/exact sats amount/i.test(brief.directReservePath.quoteRule ?? '')) {
  findings.push('direct reserve path must preserve exact-sats quote rule');
}
if (!/Do not send a payment address/i.test(brief.directReservePath.paymentAddressPolicy ?? '')) {
  findings.push('payment address policy must block unapproved payment instructions');
}
const expectedOfferIds = new Set((revenuePlan.revenueStreams ?? []).map((stream) => stream.id));
for (const offer of brief.directReservePath.supportedOffers) {
  if (!expectedOfferIds.has(offer.offerId)) {
    findings.push(`${offer.offerId}: unsupported offer in direct reserve path`);
  }
  if (offer.hasTemplate !== true) {
    findings.push(`${offer.offerId}: BTC invoice template must be ready`);
  }
  if (!/sats-invoice-quote-agent\.mjs write-draft/.test(offer.quoteCommand ?? '')) {
    findings.push(`${offer.offerId}: quote command must use the invoice quote agent`);
  }
  if (!/--evidence "<customer-invoice-request-evidence>"/.test(offer.quoteCommand ?? '')) {
    findings.push(`${offer.offerId}: quote command must require customer invoice-request evidence`);
  }
}
for (const currency of revenuePlan.allocationPolicy?.currencyPreference ?? []) {
  if (currency === 'BTC') continue;
  const option = brief.alternativeSettlementPaths.find(
    (item) => item.settlementCurrency === currency
  );
  if (!option) {
    findings.push(`${currency}: alternative settlement path is missing`);
    continue;
  }
  if (option.status !== 'planning-only-not-invoice-enabled') {
    findings.push(`${currency}: alternative settlement path must remain planning-only`);
  }
  if (!/separate Executive Chairman approval/i.test(option.customerReply ?? '')) {
    findings.push(`${currency}: customer reply must require separate chairman approval`);
  }
  if (!/Do not send .*instructions/i.test(option.stopRule ?? '')) {
    findings.push(`${currency}: stop rule must block payment instructions`);
  }
}
if (!/BTC direct to the published reserve is the current implemented invoice path/i.test(
  brief.customerReplyTemplates.btcPreferred ?? ''
)) {
  findings.push('BTC customer reply must state the implemented path');
}
if (!/not the current direct reserve invoice path/i.test(
  brief.customerReplyTemplates.alternativeRequested ?? ''
)) {
  findings.push('alternative customer reply must state that non-BTC is not direct-reserve enabled');
}
for (const rule of [
  /No payment address/i,
  /No invoice without customer request evidence/i,
  /No USDC, SOL/i,
  /No reserve progress counted/i
]) {
  if (!brief.stopRules.some((item) => rule.test(item))) {
    findings.push(`stop rules missing ${rule}`);
  }
}
if (!markdown.includes('## Direct Reserve Path')) {
  findings.push('markdown must include direct reserve path section');
}
if (!markdown.includes('## Alternative Settlement Paths')) {
  findings.push('markdown must include alternative settlement paths section');
}
if (!markdown.includes('## Customer Reply Templates')) {
  findings.push('markdown must include customer reply templates section');
}
if (markdown.includes(invoiceQueue.paymentPolicy.reserveAddress)) {
  findings.push('settlement markdown must not expose the reserve address as a payment instruction');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|pump|moon|100x)\b/i.test(markdown)) {
  findings.push('settlement markdown must not include prohibited or secret-requesting language');
}
if (/writeFile\(.*sats-invoice-queue|writeFile\(.*executive-approval|fetch\(|createPost|post-next-approved/.test(agent)) {
  findings.push('settlement brief agent must not mutate invoice state, approval state, fetch prices, or post externally');
}
if (packageJson.scripts?.['ops:settlement-options-check'] !== 'node scripts/validate-settlement-options-brief.mjs') {
  findings.push('package.json must expose ops:settlement-options-check');
}
if (packageJson.scripts?.['ops:settlement-options-write'] !== 'node scripts/settlement-options-brief-agent.mjs write') {
  findings.push('package.json must expose ops:settlement-options-write');
}
if (publicBrief) {
  const expectedPublicBrief = buildSettlementOptionsBrief({
    status,
    revenuePlan,
    invoiceQueue,
    report,
    generatedAtUtc: publicBrief.generatedAtUtc
  });
  if (JSON.stringify(publicBrief) !== JSON.stringify(expectedPublicBrief)) {
    findings.push('public settlement-options-brief.json must match current generated brief');
  }
  if (
    publicMarkdown &&
    normalizeMarkdown(publicMarkdown) !== normalizeMarkdown(renderSettlementOptionsMarkdown(publicBrief))
  ) {
    findings.push('public settlement-options-brief.md must match public JSON brief');
  }
}
if (publicMarkdown && !publicBrief) {
  findings.push('public settlement-options-brief.md requires matching JSON');
}

if (findings.length > 0) {
  console.error('Settlement options brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Settlement options brief check passed: payment-method replies preserve invoice gates.');

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

function normalizeMarkdown(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}
