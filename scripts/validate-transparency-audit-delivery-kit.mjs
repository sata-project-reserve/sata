import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const kit = JSON.parse(readFileSync(join('public', 'transparency-audit-delivery-kit.json'), 'utf8'));
const revenuePlan = JSON.parse(readFileSync(join('public', 'revenue-operating-plan.json'), 'utf8'));
const invoiceQueue = JSON.parse(readFileSync(join('public', 'sats-invoice-queue.json'), 'utf8'));
const prospectPipeline = JSON.parse(readFileSync(join('public', 'sats-prospect-pipeline.json'), 'utf8'));
const intakeForm = readFileSync(
  join('.github', 'ISSUE_TEMPLATE', 'transparency-audit-intake.yml'),
  'utf8'
);
const findings = [];

if (kit.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (kit.mode !== 'transparency-audit-delivery-kit') {
  findings.push('mode must be transparency-audit-delivery-kit');
}
if (!/confirmed BTC reserve sats/i.test(kit.objective ?? '')) {
  findings.push('objective must reference confirmed BTC reserve sats');
}

const revenueOffer = (revenuePlan.revenueStreams ?? []).find(
  (stream) => stream.id === kit.primaryOfferId
);
if (!revenueOffer) findings.push('primaryOfferId must exist in revenue-operating-plan.json');
if (revenueOffer && revenueOffer.priceUsd !== kit.priceUsd) {
  findings.push('priceUsd must match the revenue plan starter audit price');
}
if (!(invoiceQueue.invoices ?? []).some((invoice) => invoice.offerId === kit.primaryOfferId)) {
  findings.push('primaryOfferId must have an invoice template');
}
if (prospectPipeline.primaryOfferId !== kit.primaryOfferId) {
  findings.push('primaryOfferId must match sats-prospect-pipeline.json');
}
if (!/chairman-approved BTC invoices/i.test(kit.paymentDependency ?? '')) {
  findings.push('paymentDependency must require chairman-approved BTC invoices');
}
if (!/transparency-audit-intake\.yml/i.test(kit.intakeUrl ?? '')) {
  findings.push('intakeUrl must point to the transparency audit intake issue form');
}

for (const field of [
  'projectName',
  'network',
  'tokenOrContractAddress',
  'publicProjectUrl',
  'publicProfileUrl',
  'claimsToReview',
  'requestedDeliverableVisibility',
  'paymentStatus'
]) {
  if (!(kit.requiredClientIntake ?? []).includes(field)) {
    findings.push(`requiredClientIntake missing ${field}`);
  }
  if (!new RegExp(`id:\\s*${field}\\b`).test(intakeForm)) {
    findings.push(`intake issue form missing field ${field}`);
  }
}

for (const required of [
  /SATA does not provide price promotion/i,
  /market-making/i,
  /investor targeting/i,
  /fake engagement/i,
  /Executive Chairman approval/i
]) {
  if (!required.test(intakeForm)) findings.push(`intake issue form missing ${required}`);
}

const sections = kit.deliverableTemplate?.sections ?? [];
for (const section of [
  /Scope and limitations/i,
  /Public inputs reviewed/i,
  /Token authority review/i,
  /Liquidity and lock evidence review/i,
  /Reserve or treasury claim review/i,
  /Disclosure gaps/i,
  /Risk language/i,
  /Evidence links/i
]) {
  if (!sections.some((value) => section.test(value))) {
    findings.push(`deliverableTemplate.sections missing ${section}`);
  }
}

const disclosures = (kit.deliverableTemplate?.requiredDisclosures ?? []).join('\n');
for (const disclosure of [
  /not legal, tax, or investment advice/i,
  /No price guarantee/i,
  /no redemption promise/i,
  /no market-support commitment/i,
  /Unverified claims/i
]) {
  if (!disclosure.test(disclosures)) {
    findings.push(`requiredDisclosures missing ${disclosure}`);
  }
}

const quality = (kit.qualityGates ?? []).join('\n');
for (const gate of [
  /public evidence/i,
  /verified, partially verified, and unverified/i,
  /safe, profitable, backed, guaranteed, or investment grade/i,
  /trading, price, buyer, or market-making recommendations/i,
  /concrete fix/i,
  /sats-generation-ledger/i
]) {
  if (!gate.test(quality)) findings.push(`qualityGates missing ${gate}`);
}

for (const [field, minimum] of [
  ['starterAuditTurnaroundHours', 1],
  ['maximumActiveStarterAudits', 1],
  ['followUpWindowDays', 1]
]) {
  const value = Number(kit.deliveryCadence?.[field]);
  if (!Number.isSafeInteger(value) || value < minimum) {
    findings.push(`deliveryCadence.${field} must be an integer >= ${minimum}`);
  }
}

for (const field of ['draftPattern', 'finalPattern', 'publicSummaryPattern']) {
  if (!kit.artifactNaming?.[field] || typeof kit.artifactNaming[field] !== 'string') {
    findings.push(`artifactNaming.${field} must be a string`);
  }
}

if (!/first paid audit/i.test(kit.nextOperatingAction ?? '')) {
  findings.push('nextOperatingAction must identify the next paid-audit delivery action');
}

if (findings.length > 0) {
  console.error('Transparency audit delivery kit check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Transparency audit delivery kit check passed: paid-audit delivery is bounded and repeatable.');
