import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAuditIntakeDraft } from './lib/audit-intake-parser.mjs';

const deliveryKit = readJson(join('public', 'transparency-audit-delivery-kit.json'));
const prospectPipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const invoiceQueue = readJson(join('public', 'sats-invoice-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'transparency-audit-intake-issue.json'));
const form = readFileSync(
  join('.github', 'ISSUE_TEMPLATE', 'transparency-audit-intake.yml'),
  'utf8'
);
const draft = buildAuditIntakeDraft({
  issue: issueFixture,
  deliveryKit,
  prospectPipeline,
  invoiceQueue
});
const findings = [];

if (!/transparency-audit-intake\.yml/i.test(deliveryKit.intakeUrl ?? '')) {
  findings.push('delivery kit must link to the transparency audit intake form');
}
if (!/service-intake/.test(form)) findings.push('issue form must apply the service-intake label');
if (!/id:\s*referralPartner/.test(form)) {
  findings.push('issue form must include optional referralPartner field');
}
if (!/id:\s*referralSource/.test(form)) {
  findings.push('issue form must include optional referralSource field');
}
if (!(deliveryKit.optionalReferralIntake ?? []).includes('referralPartner')) {
  findings.push('delivery kit must list optional referralPartner intake');
}
if (!(deliveryKit.optionalReferralIntake ?? []).includes('referralSource')) {
  findings.push('delivery kit must list optional referralSource intake');
}
if (draft.missingRequiredFields.length > 0) {
  findings.push(`fixture missing required fields: ${draft.missingRequiredFields.join(', ')}`);
}
if (draft.intake.referralPartner !== 'Diana Crypto') {
  findings.push('parser must capture referral partner field');
}
if (!draft.prospectDraft.evidence.includes('referralPartner:Diana Crypto')) {
  findings.push('prospect draft evidence must preserve referral partner');
}
if (draft.deliveryDraft.referralSource !== 'https://x.com/142C_/status/2086570576530010172') {
  findings.push('delivery draft must preserve referral source');
}
if (draft.prospectDraft.stage !== 'identified') {
  findings.push('imported prospect drafts must start at identified until chairman review');
}
if (draft.prospectDraft.chairmanApprovedBeforeOutreach !== false) {
  findings.push('imported prospect drafts must not claim chairman approval');
}
if (draft.inboundLeadDraft.sourceType !== 'github-issue') {
  findings.push('intake issue must produce a github-issue inbound lead draft');
}
if (draft.inboundLeadDraft.status !== 'invoice-requested-needs-chairman-review') {
  findings.push('invoice-requesting intake must become chairman-review inbound lead draft');
}
if (draft.inboundLeadDraft.customerAskedForInvoice !== true) {
  findings.push('invoice-requesting intake must preserve customerAskedForInvoice true');
}
if (!draft.inboundLeadDraft.recordCommand.includes('inbound-service-lead-agent.mjs record-lead')) {
  findings.push('intake draft must expose inbound lead record command');
}
if (
  !draft.inboundLeadDraft.recordFromIssueCommand.includes(
    'inbound-service-lead-agent.mjs record-from-intake-issue-json'
  )
) {
  findings.push('intake draft must expose intake issue JSON record command');
}
if (!draft.inboundLeadDraft.recordFromIssueCommand.includes('--issue "<issue-json-path>"')) {
  findings.push('intake issue JSON record command must require issue JSON path');
}
if (
  !draft.inboundLeadDraft.recordFromIssueCommand.includes('--recordedAtUtc "<recorded-at-utc>"')
) {
  findings.push('intake issue JSON record command must require recordedAtUtc evidence');
}
if (!draft.inboundLeadDraft.recordCommand.includes('--sourceType github-issue')) {
  findings.push('intake draft record command must preserve github-issue attribution');
}
if (!draft.inboundLeadDraft.recordCommand.includes('--customerAskedForInvoice true')) {
  findings.push('intake draft record command must preserve invoice-request flag');
}
if (!draft.inboundLeadDraft.recordCommand.includes('--recordedAtUtc "<recorded-at-utc>"')) {
  findings.push('intake draft record command must require recordedAtUtc evidence');
}
if (draft.invoiceDraft.chairmanApprovalRequired !== true) {
  findings.push('invoice drafts must require chairman approval');
}
if (draft.invoiceDraft.paymentAddress !== invoiceQueue.paymentPolicy.reserveAddress) {
  findings.push('invoice draft payment address must match invoice queue reserve address');
}
if (draft.invoiceDraft.amountSats !== 'quote-required-before-sending') {
  findings.push('invoice draft must require exact sats quote before sending');
}
if (!/Executive Chairman approval/i.test(draft.nextRequiredAction)) {
  findings.push('complete intakes must route to Executive Chairman approval');
}
if (!draft.deliveryDraft.sections.includes('Evidence links')) {
  findings.push('delivery draft must include evidence links section');
}

if (findings.length > 0) {
  console.error('Audit intake workflow check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Audit intake workflow check passed: issue intake maps to reviewable prospect, invoice, and delivery drafts.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
