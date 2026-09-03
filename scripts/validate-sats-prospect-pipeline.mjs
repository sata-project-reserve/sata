import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateProspectStageApprovalIntegrity } from './lib/prospect-stage-transition.mjs';
import { validateProspectResponseEvidence } from './lib/prospect-response-transition.mjs';

const pipeline = JSON.parse(readFileSync(join('public', 'sats-prospect-pipeline.json'), 'utf8'));
const revenuePlan = JSON.parse(readFileSync(join('public', 'revenue-operating-plan.json'), 'utf8'));
const invoiceQueue = JSON.parse(readFileSync(join('public', 'sats-invoice-queue.json'), 'utf8'));
const approvalQueue = JSON.parse(readFileSync(join('public', 'executive-approval-queue.json'), 'utf8'));
const findings = [];

if (pipeline.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (pipeline.mode !== 'service-revenue-prospect-pipeline') {
  findings.push('mode must be service-revenue-prospect-pipeline');
}
if (!/confirmed BTC reserve sats/i.test(pipeline.objective ?? '')) {
  findings.push('objective must reference confirmed BTC reserve sats');
}
if (pipeline.activeCycleId !== revenuePlan.nextCycle?.id) {
  findings.push('activeCycleId must match revenueOperatingPlan.nextCycle.id');
}

const revenueOfferIds = new Set((revenuePlan.revenueStreams ?? []).map((stream) => stream.id));
const invoiceOfferIds = new Set((invoiceQueue.invoices ?? []).map((invoice) => invoice.offerId));
if (!revenueOfferIds.has(pipeline.primaryOfferId)) {
  findings.push('primaryOfferId must exist in revenue-operating-plan.json');
}
if (!invoiceOfferIds.has(pipeline.primaryOfferId)) {
  findings.push('primaryOfferId must have an invoice template');
}
if (!/prospect-candidate-intake\.yml/i.test(pipeline.prospectIntakeUrl ?? '')) {
  findings.push('prospectIntakeUrl must link to the prospect candidate issue form');
}

for (const field of ['firstClosedDealUsd', 'cycleClosedRevenueUsd', 'reserveTargetSats']) {
  if (!/^\d+$/.test(pipeline.target?.[field] ?? '')) {
    findings.push(`target.${field} must be an integer string`);
  }
}

const profiles = pipeline.idealCustomerProfile ?? [];
if (profiles.length < 2) findings.push('idealCustomerProfile must include at least two segments');
for (const profile of profiles) {
  for (const field of ['id', 'description', 'bestOfferId']) {
    if (!profile[field] || typeof profile[field] !== 'string') {
      findings.push(`${profile.id ?? '<missing-profile>'}: missing string field ${field}`);
    }
  }
  if (!revenueOfferIds.has(profile.bestOfferId)) {
    findings.push(`${profile.id}: bestOfferId must exist in revenue-operating-plan.json`);
  }
  if ((profile.qualificationSignals ?? []).length < 3) {
    findings.push(`${profile.id}: qualificationSignals must include at least three entries`);
  }
}

const stages = pipeline.leadStages ?? [];
for (const requiredStage of [
  'identified',
  'qualified',
  'chairman-review',
  'outreach-approved',
  'contacted',
  'invoice-requested',
  'paid',
  'delivered',
  'closed-lost'
]) {
  if (!stages.includes(requiredStage)) findings.push(`leadStages missing ${requiredStage}`);
}

const requiredLeadFields = pipeline.requiredLeadFields ?? [];
for (const field of [
  'id',
  'stage',
  'source',
  'publicProfileUrl',
  'projectUrl',
  'observedClaim',
  'recommendedOfferId',
  'chairmanApprovedBeforeOutreach',
  'evidence'
]) {
  if (!requiredLeadFields.includes(field)) findings.push(`requiredLeadFields missing ${field}`);
}

const templates = pipeline.approvedOutreachTemplates ?? [];
if (templates.length < 2) findings.push('approvedOutreachTemplates must include at least two templates');
for (const template of templates) {
  for (const field of ['id', 'offerId', 'channel', 'text']) {
    if (!template[field] || typeof template[field] !== 'string') {
      findings.push(`${template.id ?? '<missing-template>'}: missing string field ${field}`);
    }
  }
  if (!revenueOfferIds.has(template.offerId)) {
    findings.push(`${template.id}: offerId must exist in revenue-operating-plan.json`);
  }
  if (!/transparency|audit|report/i.test(template.text ?? '')) {
    findings.push(`${template.id}: template must sell transparency audit or report work`);
  }
  if (!/No price|no price|price guarantee/i.test(template.text ?? '')) {
    findings.push(`${template.id}: template must include no-price-guarantee language`);
  }
  for (const prohibited of [
    /pump/i,
    /guaranteed buyers/i,
    /fake engagement/i,
    /bots/i,
    /raids/i,
    /price prediction/i
  ]) {
    if (prohibited.test(template.text ?? '')) {
      findings.push(`${template.id}: template contains prohibited wording ${prohibited}`);
    }
  }
  if (
    !/no investor targeting/i.test(template.text ?? '') &&
    /investor targeting/i.test(template.text ?? '')
  ) {
    findings.push(`${template.id}: investor-targeting wording must be explicitly prohibited`);
  }
  if (
    !/no market-support promises/i.test(template.text ?? '') &&
    /market-support promises/i.test(template.text ?? '')
  ) {
    findings.push(`${template.id}: market-support wording must be explicitly prohibited`);
  }
}

const rules = (pipeline.qualificationRules ?? []).join('\n');
for (const required of [
  /evidence review|reporting setup/i,
  /bots|fake engagement|raids|investor lists/i,
  /public project URL|token address/i,
  /chairman approves/i,
  /published reserve address|chairman-approved address/i
]) {
  if (!required.test(rules)) findings.push(`qualificationRules missing ${required}`);
}

for (const [field, minimum] of [
  ['identifyProspects', 1],
  ['qualifyProspects', 1],
  ['chairmanReviewBatchSize', 1],
  ['outreachLimit', 1],
  ['followUpAfterHours', 24]
]) {
  const value = Number(pipeline.dailyCadence?.[field]);
  if (!Number.isSafeInteger(value) || value < minimum) {
    findings.push(`dailyCadence.${field} must be an integer >= ${minimum}`);
  }
}

for (const prospect of pipeline.prospects ?? []) {
  for (const field of requiredLeadFields) {
    if (prospect[field] === undefined || prospect[field] === '') {
      findings.push(`${prospect.id ?? '<missing-prospect>'}: missing required field ${field}`);
    }
  }
  if (!stages.includes(prospect.stage)) {
    findings.push(`${prospect.id}: stage must be one of leadStages`);
  }
  if (prospect.chairmanApprovedBeforeOutreach !== true && prospect.stage !== 'identified') {
    findings.push(`${prospect.id}: non-identified prospects require chairmanApprovedBeforeOutreach`);
  }
  if (!Array.isArray(prospect.evidence) || prospect.evidence.length === 0) {
    findings.push(`${prospect.id}: evidence must include at least one link or note`);
  }
}

try {
  validateProspectStageApprovalIntegrity({ pipeline, approvalQueue });
} catch (error) {
  findings.push(error.message);
}

try {
  validateProspectResponseEvidence({ pipeline });
} catch (error) {
  findings.push(error.message);
}

if (!/Identify ten crypto teams/i.test(pipeline.nextOperatingAction ?? '')) {
  findings.push('nextOperatingAction must direct the next prospect-identification batch');
}

if (findings.length > 0) {
  console.error('Sats prospect pipeline check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats prospect pipeline check passed: service-revenue prospecting is bounded and reviewable.');
