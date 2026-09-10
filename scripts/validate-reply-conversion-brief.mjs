import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReplyConversionBrief,
  renderReplyConversionMarkdown
} from './reply-conversion-brief-agent.mjs';

const status = readJson(join('public', 'revenue-cycle-status.json'));
const prospectPipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const outreachPacketQueue = readJson(join('public', 'service-outreach-packet-queue.json'));
const inboundLeadQueue = readJson(join('public', 'inbound-service-lead-queue.json'));
const revenuePlan = readJson(join('public', 'revenue-operating-plan.json'));
const brief = buildReplyConversionBrief({
  status,
  prospectPipeline,
  outreachPacketQueue,
  inboundLeadQueue,
  revenuePlan
});
const markdown = renderReplyConversionMarkdown(brief);
const publicBrief = readOptionalJson(join('public', 'reply-conversion-brief.json'));
const publicMarkdown = readOptionalText(join('public', 'reply-conversion-brief.md'));
const findings = [];

if (brief.mode !== 'chairman-gated-reply-conversion-brief') {
  findings.push('brief mode must be chairman-gated-reply-conversion-brief');
}
if (!/reply-conversion evidence only/i.test(brief.boundary ?? '')) {
  findings.push('boundary must describe reply-conversion evidence only');
}
if (!/does not contact prospects/i.test(brief.boundary ?? '')) {
  findings.push('boundary must prohibit autonomous prospect contact');
}
if (!/does not .*move assets/i.test(brief.boundary ?? '')) {
  findings.push('boundary must prohibit asset movement');
}
if (brief.counts.outreachApprovedProspects !== String(status.funnel.outreachApprovedProspects)) {
  findings.push('outreach-approved count must match revenue cycle status');
}
if (brief.counts.readyOutreachPackets !== String(status.funnel.readyOutreachPackets)) {
  findings.push('ready outreach packet count must match revenue cycle status');
}
if (brief.counts.inboundInvoiceRequests !== String(brief.inboundInvoiceRequests.length)) {
  findings.push('inbound invoice request count must match exposed inbound records');
}
if (!brief.conversionStages.some((stage) => stage.id === 'record-sent-contact')) {
  findings.push('brief must include record-sent-contact stage');
}
const triageStage = brief.conversionStages.find((stage) => stage.id === 'triage-inbound-reply');
if (!triageStage) {
  findings.push('brief must include triage-inbound-reply stage');
}
if (!/inbound-reply-triage-agent\.mjs markdown/.test(triageStage?.commandTemplate ?? '')) {
  findings.push('triage-inbound-reply stage must expose the inbound reply triage agent');
}
if (!/--replyText "<reply-or-dm-text>"/.test(triageStage?.commandTemplate ?? '')) {
  findings.push('triage-inbound-reply stage must require the reply text');
}
if (!/--recordedAtUtc "<recorded-at-utc>"/.test(triageStage?.commandTemplate ?? '')) {
  findings.push('triage-inbound-reply stage must require explicit recordedAtUtc evidence');
}
const recordSentContactStage = brief.conversionStages.find((stage) => stage.id === 'record-sent-contact');
if (!/--messageHash "<approved-message-sha256>"/.test(recordSentContactStage?.commandTemplate ?? '')) {
  findings.push('record-sent-contact stage must require the approved message SHA-256');
}
if (!brief.conversionStages.some((stage) => stage.id === 'record-invoice-request')) {
  findings.push('brief must include record-invoice-request stage');
}
if (!brief.conversionStages.some((stage) => stage.id === 'render-outbound-invoice-request-packet')) {
  findings.push('brief must include outbound invoice packet rendering stage');
}
if (!brief.conversionStages.some((stage) => stage.id === 'render-inbound-invoice-request-packet')) {
  findings.push('brief must include inbound invoice packet rendering stage');
}
const firstManualOutreachAction = (status.actionQueue ?? []).find(
  (item) => item.type === 'manual-outreach-send'
);
if (
  firstManualOutreachAction &&
  brief.eligibleContactRecording[0]?.packetId &&
  firstManualOutreachAction.id !== `send-${brief.eligibleContactRecording[0].packetId}`
) {
  findings.push('eligible contact recording must start with the current priority-scored outreach packet');
}
for (const item of brief.eligibleContactRecording) {
  if (!/mark-sent --packet/.test(item.recordSentContactCommand ?? '')) {
    findings.push(`${item.prospectId}: contact command must mark the outreach packet sent`);
  }
  if (!/--sentAtUtc "<sent-at-utc>"/.test(item.recordSentContactCommand ?? '')) {
    findings.push(`${item.prospectId}: contact command must require explicit sentAtUtc evidence`);
  }
  if (!/--messageHash [0-9a-f]{64}\b/.test(item.recordSentContactCommand ?? '')) {
    findings.push(`${item.prospectId}: contact command must require the approved message SHA-256`);
  }
  if (!item.packetId || item.packetId === 'not-found') {
    findings.push(`${item.prospectId}: contact record must link to an outreach packet`);
  }
  if (!item.currentOfferId) {
    findings.push(`${item.prospectId}: contact record must expose the current approved outreach offer`);
  }
  if (
    !Number.isSafeInteger(Number(item.currentAskUsd)) ||
    Number(item.currentAskUsd) <= 0
  ) {
    findings.push(`${item.prospectId}: contact record must expose the current approved ask`);
  }
  if (!Number.isSafeInteger(item.priority?.score) || item.priority.score <= 0) {
    findings.push(`${item.prospectId}: contact record must expose positive outreach priority`);
  }
  if (
    !Number.isSafeInteger(Number(item.qualifiedRevenueUsd)) ||
    Number(item.qualifiedRevenueUsd) <= 0
  ) {
    findings.push(`${item.prospectId}: contact record must expose qualified revenue`);
  }
  if (Number(item.qualifiedRevenueUsd) > Number(item.currentAskUsd)) {
    if (!item.conversionPlan || typeof item.conversionPlan !== 'object') {
      findings.push(`${item.prospectId}: higher-value contact record must expose a conversion plan`);
    } else {
      if (item.conversionPlan.upgradeOfferId !== item.recommendedOfferId) {
        findings.push(`${item.prospectId}: conversion plan must point to the recommended offer`);
      }
      if (!/only after/i.test(item.conversionPlan.rule ?? '')) {
        findings.push(`${item.prospectId}: conversion plan must preserve explicit-fit gating`);
      }
      if ((item.conversionPlan.qualificationQuestions ?? []).length < 2) {
        findings.push(`${item.prospectId}: conversion plan must include qualification questions`);
      }
    }
  }
  if (!item.tracking || typeof item.tracking !== 'object') {
    findings.push(`${item.prospectId}: contact record must include tracking URLs`);
  } else {
    for (const field of ['serviceUrl', 'sampleAuditUrl', 'intakeUrl']) {
      if (!/utm_source=manual_outreach/i.test(item.tracking[field] ?? '')) {
        findings.push(`${item.prospectId}: tracking.${field} must include manual_outreach UTM`);
      }
    }
  }
}
for (const item of brief.eligibleInvoiceRequestRecording) {
  if (!/--confirmedCustomerRequestedInvoice true/.test(item.recordInvoiceRequestCommand ?? '')) {
    findings.push(`${item.prospectId}: invoice request command must require explicit customer ask`);
  }
  if (!item.contactEvidence) {
    findings.push(`${item.prospectId}: invoice request candidate must include contact evidence`);
  }
}
for (const item of brief.eligibleOutboundInvoicePackets) {
  if (!/sats-invoice-request-agent\.mjs render --prospects/.test(item.renderCommand ?? '')) {
    findings.push(`${item.prospectId}: outbound invoice packet must use render --prospects`);
  }
}
for (const item of brief.inboundInvoiceRequests) {
  if (!/inbound-invoice-request-agent\.mjs render --lead/.test(item.renderCommand ?? '')) {
    findings.push(`${item.leadId}: inbound invoice packet must use render --lead`);
  }
}
if (!brief.stopRules.some((rule) => /chairman-approved exact-sats invoice/i.test(rule))) {
  findings.push('stop rules must preserve chairman-approved exact-sats invoice gate');
}
if (!brief.stopRules.some((rule) => /customer explicitly asks/i.test(rule))) {
  findings.push('stop rules must require explicit customer invoice request');
}
if (!brief.stopRules.some((rule) => /No autonomous transactions/i.test(rule))) {
  findings.push('stop rules must prohibit autonomous transactions');
}
if (!markdown.includes('## Current Counts')) {
  findings.push('markdown must include current counts section');
}
if (!markdown.includes('## Next Action')) {
  findings.push('markdown must include next action section');
}
if (!markdown.includes('## Stop Rules')) {
  findings.push('markdown must include stop rules section');
}
if (!markdown.includes('utm_source=manual_outreach')) {
  findings.push('markdown must include tracked manual outreach URLs');
}
if (!markdown.includes('Current approved ask:')) {
  findings.push('markdown must separate the current approved ask from the qualified revenue path');
}
if (!markdown.includes('Upgrade path:')) {
  findings.push('markdown must expose the qualified upgrade path when present');
}
for (const command of markdown.match(/node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g) ?? []) {
  if (!/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(command)) {
    findings.push(`markdown mark-sent command must require messageHash: ${command}`);
  }
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|pump)\b/i.test(markdown)) {
  findings.push('reply conversion brief must not include prohibited or secret-requesting language');
}
if (publicBrief) {
  const expectedPublicBrief = buildReplyConversionBrief({
    status,
    prospectPipeline,
    outreachPacketQueue,
    inboundLeadQueue,
    revenuePlan,
    generatedAtUtc: publicBrief.generatedAtUtc,
    maxItems: 5
  });
  if (JSON.stringify(publicBrief) !== JSON.stringify(expectedPublicBrief)) {
    findings.push('public reply-conversion-brief.json must match the current generated brief');
  }
  if (publicMarkdown && publicMarkdown !== renderReplyConversionMarkdown(publicBrief)) {
    findings.push('public reply-conversion-brief.md must match the public JSON brief');
  }
  for (const item of publicBrief.eligibleContactRecording ?? []) {
    if (!/--messageHash [0-9a-f]{64}\b/.test(item.recordSentContactCommand ?? '')) {
      findings.push(`${item.prospectId}: public contact command must require the approved message SHA-256`);
    }
  }
}
if (publicMarkdown && !publicBrief) {
  findings.push('public reply-conversion-brief.md requires matching reply-conversion-brief.json');
}
if (publicMarkdown) {
  for (const command of publicMarkdown.match(/node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g) ?? []) {
    if (!/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(command)) {
      findings.push(`public markdown mark-sent command must require messageHash: ${command}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Reply conversion brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Reply conversion brief check passed: reply evidence gates are public, bounded, and chairman-gated.'
);

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
