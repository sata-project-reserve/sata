import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildOutreachDispatchBrief,
  renderOutreachDispatchMarkdown
} from './outreach-dispatch-brief-agent.mjs';

const status = readJson(join('public', 'revenue-cycle-status.json'));
const packetQueue = readJson(join('public', 'service-outreach-packet-queue.json'));
const approvalQueue = readJson(join('public', 'executive-approval-queue.json'));
const revenuePlan = readJson(join('public', 'revenue-operating-plan.json'));
const prospectPipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const brief = buildOutreachDispatchBrief({ status, packetQueue, approvalQueue, revenuePlan, prospectPipeline });
const markdown = renderOutreachDispatchMarkdown(brief);
const publicBrief = readOptionalJson(join('public', 'outreach-dispatch-brief.json'));
const publicMarkdown = readOptionalText(join('public', 'outreach-dispatch-brief.md'));
const findings = [];

if (brief.mode !== 'manual-outreach-dispatch-brief') {
  findings.push('brief mode must be manual-outreach-dispatch-brief');
}
if (!/does not approve outreach/i.test(brief.boundary ?? '')) {
  findings.push('brief boundary must say it does not approve outreach');
}
if (!/does not .*move assets/i.test(brief.boundary ?? '')) {
  findings.push('brief boundary must say it does not move assets');
}
if (brief.readyManualSendCount !== status.funnel.readyOutreachPackets) {
  findings.push('ready manual send count must match revenue cycle status');
}
if (brief.readyManualSends.length !== Math.min(brief.readyManualSendCount, brief.maxManualSends)) {
  findings.push('ready manual sends must expose only the current bounded sprint');
}
if (
  brief.queuedRemainderCount !==
  Math.max(brief.readyManualSendCount - brief.readyManualSends.length, 0)
) {
  findings.push('queued remainder count must match ready backlog minus sprint size');
}
if (!/focused manual sprint/i.test(brief.dispatchRule ?? '')) {
  findings.push('dispatch rule must require a focused manual sprint');
}
if (brief.sprintEconomics?.reserveAllocationPercent !== '70') {
  findings.push('sprint economics must preserve the 70 percent BTC reserve allocation policy');
}
if (Number(brief.sprintEconomics?.qualifiedGrossRevenueUsd) < Number(brief.sprintEconomics?.grossRevenueUsd)) {
  findings.push('qualified sprint revenue must be at least current approved sprint revenue');
}
if (!Number.isSafeInteger(Number(brief.sprintEconomics?.reserveSatsAtPlanningRate))) {
  findings.push('sprint economics must include reserve sats at the planning rate');
}
if (
  !Number.isSafeInteger(Number(brief.sprintEconomics?.qualifiedReserveSatsAtPlanningRate)) ||
  Number(brief.sprintEconomics?.qualifiedReserveSatsAtPlanningRate) <
    Number(brief.sprintEconomics?.reserveSatsAtPlanningRate)
) {
  findings.push('sprint economics must include qualified reserve sats at or above current reserve sats');
}
if (!/upgrade-path planning only/i.test(brief.sprintEconomics?.grossRevenueBasis ?? '')) {
  findings.push('sprint economics must distinguish current asks from qualified upgrade planning');
}
if (!/one explicit invoice request/i.test(brief.sprintEconomics?.firstConversionGoal ?? '')) {
  findings.push('sprint economics must define the first invoice-request conversion goal');
}
if (!/confirmed receipts/i.test(brief.sprintEconomics?.measurementRule ?? '')) {
  findings.push('sprint economics must measure through confirmed receipts');
}
if (!/Prioritize higher-value/i.test(brief.prioritizationRule ?? '')) {
  findings.push('dispatch brief must describe deterministic prospect prioritization');
}
const readyPacketProspectIds = new Set(
  (packetQueue.packets ?? [])
    .filter((packet) => packet.status === 'ready-for-manual-send')
    .map((packet) => packet.prospectId)
);
const higherValueReadyProspectIds = new Set(
  (prospectPipeline.prospects ?? [])
    .filter(
      (prospect) =>
        readyPacketProspectIds.has(prospect.id) &&
        ['transparency-report-setup', 'full-proof-dashboard'].includes(
          prospect.recommendedOfferId
        )
    )
    .map((prospect) => prospect.id)
);
if (
  higherValueReadyProspectIds.size > 0 &&
  !brief.readyManualSends.some((packet) => higherValueReadyProspectIds.has(packet.prospectId))
) {
  findings.push('ready manual sends must include at least one higher-value recommended prospect');
}
for (let index = 1; index < brief.readyManualSends.length; index += 1) {
  if (brief.readyManualSends[index - 1].priority.score < brief.readyManualSends[index].priority.score) {
    findings.push('ready manual sends must be sorted by descending priority score');
  }
}
for (const packet of brief.readyManualSends) {
  if (!Number.isSafeInteger(packet.priority?.score) || packet.priority.score <= 0) {
    findings.push(`${packet.packetId}: ready packet must expose a positive priority score`);
  }
  if (!['hot', 'warm', 'standard'].includes(packet.priority?.tier)) {
    findings.push(`${packet.packetId}: ready packet must expose a known priority tier`);
  }
  if (!Array.isArray(packet.priority?.reasons) || packet.priority.reasons.length < 3) {
    findings.push(`${packet.packetId}: ready packet priority must include evidence-backed reasons`);
  }
  if (
    !Number.isSafeInteger(Number(packet.qualifiedRevenueUsd)) ||
    Number(packet.qualifiedRevenueUsd) < Number(packet.targetRevenueUsd)
  ) {
    findings.push(`${packet.packetId}: ready packet must expose qualified revenue at or above target revenue`);
  }
  if (!packet.currentOfferId) {
    findings.push(`${packet.packetId}: ready packet must expose the current approved offer`);
  }
  if (
    !Number.isSafeInteger(Number(packet.currentAskUsd)) ||
    Number(packet.currentAskUsd) <= 0
  ) {
    findings.push(`${packet.packetId}: ready packet must expose the current approved ask`);
  }
  if (Number(packet.qualifiedRevenueUsd ?? 0) > Number(packet.currentAskUsd ?? 0)) {
    if (!packet.conversionPlan || typeof packet.conversionPlan !== 'object') {
      findings.push(`${packet.packetId}: higher-value ready packet must expose a conversion plan`);
    } else {
      if (packet.conversionPlan.upgradeOfferId !== packet.recommendedOfferId) {
        findings.push(`${packet.packetId}: conversion plan must point to the recommended offer`);
      }
      if (!/only after/i.test(packet.conversionPlan.rule ?? '')) {
        findings.push(`${packet.packetId}: conversion plan must preserve explicit-fit gating`);
      }
      if ((packet.conversionPlan.qualificationQuestions ?? []).length < 2) {
        findings.push(`${packet.packetId}: conversion plan must include qualification questions`);
      }
    }
  }
  if (!packet.message.includes('No price promotion')) {
    findings.push(`${packet.packetId}: ready message must preserve no-price-promotion language`);
  }
  if (!/mark-sent --packet/.test(packet.recordContactCommand ?? '')) {
    findings.push(`${packet.packetId}: ready packet must include a post-send evidence command`);
  }
  if (!/--sentAtUtc "<sent-at-utc>"/.test(packet.recordContactCommand ?? '')) {
    findings.push(`${packet.packetId}: post-send evidence command must require explicit sentAtUtc evidence`);
  }
  if (!/--messageHash [0-9a-f]{64}\b/.test(packet.recordContactCommand ?? '')) {
    findings.push(`${packet.packetId}: post-send evidence command must require approved message SHA-256`);
  }
  if (!packet.trackingLabel?.startsWith('manual_outreach:')) {
    findings.push(`${packet.packetId}: ready packet must expose a manual outreach tracking label`);
  }
  if (!packet.tracking || typeof packet.tracking !== 'object') {
    findings.push(`${packet.packetId}: ready packet must expose structured tracking URLs`);
  } else {
    for (const field of ['serviceUrl', 'sampleAuditUrl', 'intakeUrl']) {
      if (!/utm_source=manual_outreach/i.test(packet.tracking[field] ?? '')) {
        findings.push(`${packet.packetId}: tracking.${field} must include manual_outreach UTM`);
      }
    }
  }
  if (!/utm_source=manual_outreach/i.test(packet.message ?? '')) {
    findings.push(`${packet.packetId}: ready packet message must include tracked manual_outreach URLs`);
  }
  if (
    !Number.isSafeInteger(Number(packet.targetRevenueUsd)) ||
    Number(packet.targetRevenueUsd) <= 0
  ) {
    findings.push(`${packet.packetId}: ready packet must expose target revenue from its offer`);
  }
}
for (const item of brief.pendingOutreachApprovals) {
  if (!item.approveCommand.includes(`I am Executive Chairman and approve ${item.approvalId}`)) {
    findings.push(`${item.approvalId}: approval command must require exact chairman phrase`);
  }
  if (item.prospectIds.length === 0) {
    findings.push(`${item.approvalId}: pending outreach approval must expose prospect ids`);
  }
}
if (!markdown.includes('## Ready Manual Sends')) {
  findings.push('markdown brief must include ready manual sends section');
}
if (!markdown.includes('## Pending Chairman Outreach Approvals')) {
  findings.push('markdown brief must include pending chairman outreach approvals section');
}
if (!markdown.includes('## Sprint Economics')) {
  findings.push('markdown brief must include sprint economics section');
}
if (!markdown.includes('manual_outreach:')) {
  findings.push('markdown brief must include tracking labels');
}
if (!markdown.includes('Tracked service: https://') || !markdown.includes('utm_source=manual_outreach')) {
  findings.push('markdown brief must include structured tracked service URLs');
}
if (!markdown.includes('Current approved ask:')) {
  findings.push('markdown must separate the current approved ask from the qualified revenue path');
}
if (!markdown.includes('Upgrade path:')) {
  findings.push('markdown must expose the explicit-fit upgrade path');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|pump)\b/i.test(markdown)) {
  findings.push('dispatch brief must not include prohibited or secret-requesting language');
}
for (const command of markdown.match(/node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g) ?? []) {
  if (!/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(command)) {
    findings.push(`markdown mark-sent command must require messageHash: ${command}`);
  }
}
if (publicBrief) {
  const expectedPublicBrief = buildOutreachDispatchBrief({
    status,
    packetQueue,
    approvalQueue,
    revenuePlan,
    prospectPipeline,
    maxManualSends: publicBrief.maxManualSends,
    generatedAtUtc: publicBrief.generatedAtUtc
  });
  if (JSON.stringify(publicBrief) !== JSON.stringify(expectedPublicBrief)) {
    findings.push('public outreach-dispatch-brief.json must match the current generated brief');
  }
  if (
    publicMarkdown &&
    normalizeMarkdown(publicMarkdown) !==
      normalizeMarkdown(renderOutreachDispatchMarkdown(publicBrief))
  ) {
    findings.push('public outreach-dispatch-brief.md must match the public JSON brief');
  }
  for (const packet of publicBrief.readyManualSends ?? []) {
    if (!/--messageHash [0-9a-f]{64}\b/.test(packet.recordContactCommand ?? '')) {
      findings.push(`${packet.packetId}: public post-send evidence command must require approved message SHA-256`);
    }
  }
}
if (publicMarkdown && !publicBrief) {
  findings.push('public outreach-dispatch-brief.md requires matching outreach-dispatch-brief.json');
}
if (publicMarkdown) {
  for (const command of publicMarkdown.match(/node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g) ?? []) {
    if (!/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(command)) {
      findings.push(`public markdown mark-sent command must require messageHash: ${command}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Outreach dispatch brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Outreach dispatch brief check passed: ready sends and pending approvals are copy-ready and bounded.'
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

function normalizeMarkdown(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}
