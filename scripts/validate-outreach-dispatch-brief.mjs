import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildOutreachDispatchBrief,
  renderOutreachDispatchMarkdown
} from './outreach-dispatch-brief-agent.mjs';
import { buildOutreachContactEvidenceDraft } from './lib/outreach-contact-evidence-parser.mjs';
import { planningUsdToReserveSatsFloor } from './lib/planning-sats.mjs';

const status = readJson(join('public', 'revenue-cycle-status.json'));
const packetQueue = readJson(join('public', 'service-outreach-packet-queue.json'));
const approvalQueue = readJson(join('public', 'executive-approval-queue.json'));
const revenuePlan = readJson(join('public', 'revenue-operating-plan.json'));
const prospectPipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const brief = buildOutreachDispatchBrief({
  status,
  packetQueue,
  approvalQueue,
  revenuePlan,
  prospectPipeline
});
const markdown = renderOutreachDispatchMarkdown(brief);
const publicBrief = readOptionalJson(join('public', 'outreach-dispatch-brief.json'));
const publicMarkdown = readOptionalText(join('public', 'outreach-dispatch-brief.md'));
const findings = [];
const EVIDENCE_REVIEW_COMMAND = 'npm run ops:outreach-contact-evidence-plan';
const expectedSetupReserveSats = planningUsdToReserveSatsFloor({
  usd:
    revenuePlan.revenueStreams?.find((stream) => stream.id === 'transparency-report-setup')
      ?.priceUsd ?? 0,
  btcUsd: revenuePlan.planningAssumptions?.btcUsd ?? 100000,
  reserveAllocationPercent:
    revenuePlan.allocationPolicy?.postReceiptAllocationPercent?.btcReserve ?? 70
}).toString();

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
if (brief.sprintEconomics?.planningBtcUsd !== revenuePlan.planningAssumptions?.btcUsd) {
  findings.push('sprint economics BTC/USD must come from revenue-operating-plan.json');
}
if (brief.sprintEconomics?.planningBtcUsdSource !== revenuePlan.planningAssumptions?.btcUsdSource) {
  findings.push('sprint economics BTC/USD source must come from revenue-operating-plan.json');
}
if (
  Number(brief.sprintEconomics?.qualifiedGrossRevenueUsd) <
  Number(brief.sprintEconomics?.grossRevenueUsd)
) {
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
  findings.push(
    'sprint economics must include qualified reserve sats at or above current reserve sats'
  );
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
if (brief.readyManualSends.length > 0) {
  const topPacket = brief.readyManualSends[0];
  const sheet = brief.nextManualSendSheet;
  if (!sheet || typeof sheet !== 'object') {
    findings.push('dispatch brief must expose nextManualSendSheet when a packet is ready');
  } else {
    if (sheet.packetId !== topPacket.packetId || sheet.prospectId !== topPacket.prospectId) {
      findings.push('next manual send sheet must match the top prioritized ready packet');
    }
    if (sheet.exactMessage !== topPacket.message) {
      findings.push('next manual send sheet must preserve the exact approved message');
    }
    if (sheet.evidenceIssueTemplateCommand !== topPacket.evidenceIssueTemplateCommand) {
      findings.push('next manual send sheet must preserve the evidence issue helper command');
    }
    if (sheet.evidenceReviewCommand !== EVIDENCE_REVIEW_COMMAND) {
      findings.push('next manual send sheet must expose the contact evidence review command');
    }
    if (sheet.recordContactCommand !== topPacket.recordContactCommand) {
      findings.push('next manual send sheet must preserve the record-contact command');
    }
    if (!sheet.contactEvidenceIssueBodyTemplate?.includes('### Exact message sent')) {
      findings.push('next manual send sheet must include a contact evidence issue body template');
    }
    if (!sheet.contactEvidenceIssueBodyTemplate?.includes('<contact-evidence-url-or-reference>')) {
      findings.push(
        'next manual send sheet issue body must preserve the contact evidence placeholder'
      );
    }
    if (!sheet.contactEvidenceIssueBodyTemplate?.includes('<sent-at-utc>')) {
      findings.push('next manual send sheet issue body must preserve the sentAtUtc placeholder');
    }
    const sheetIssueDraft = buildOutreachContactEvidenceDraft({
      issue: { body: sheet.contactEvidenceIssueBodyTemplate },
      packetQueue,
      pipeline: prospectPipeline
    });
    if (sheetIssueDraft.messageMatchesApprovedPacket !== true) {
      findings.push('next manual send sheet issue body must preserve the exact approved message');
    }
    if (sheetIssueDraft.hashMatchesApprovedPacket !== true) {
      findings.push('next manual send sheet issue body must preserve the approved SHA-256');
    }
    if (
      sheet.approvedMessageSha256 !==
      topPacket.recordContactCommand.match(/--messageHash (?<hash>[a-f0-9]{64})\b/)?.groups?.hash
    ) {
      findings.push('next manual send sheet must expose the approved message SHA-256');
    }
    if (!/reply review/i.test(sheet.stopRule ?? '')) {
      findings.push('next manual send sheet must gate reply review');
    }
    if (!/evidence review/i.test(sheet.stopRule ?? '')) {
      findings.push('next manual send sheet must require evidence review before recording');
    }
    if (
      /\b(can|may|should)\s+(send invoices|send payment instructions|move assets)/i.test(
        sheet.stopRule ?? ''
      )
    ) {
      findings.push(
        'next manual send sheet stop rule must not permit invoices, payments, or asset movement'
      );
    }
    if (sheet.currentAskReserveSats !== topPacket.reserveImpactPlanning?.currentAskReserveSats) {
      findings.push('next manual send sheet must expose current-ask reserve impact');
    }
    if (sheet.trackedServiceUrl !== topPacket.tracking?.serviceUrl) {
      findings.push('next manual send sheet must expose the tracked service URL');
    }
    if (!/#invoice-ready-intake\b/i.test(sheet.trackedServiceUrl ?? '')) {
      findings.push('next manual send sheet tracked service URL must target invoice-ready intake');
    }
  }
} else if (brief.nextManualSendSheet !== null) {
  findings.push('nextManualSendSheet must be null when no packet is ready');
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
        ['transparency-report-setup', 'full-proof-dashboard'].includes(prospect.recommendedOfferId)
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
  if (
    brief.readyManualSends[index - 1].priority.score < brief.readyManualSends[index].priority.score
  ) {
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
    findings.push(
      `${packet.packetId}: ready packet must expose qualified revenue at or above target revenue`
    );
  }
  if (!packet.currentOfferId) {
    findings.push(`${packet.packetId}: ready packet must expose the current approved offer`);
  }
  if (!Number.isSafeInteger(Number(packet.currentAskUsd)) || Number(packet.currentAskUsd) <= 0) {
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
    if (packet.reserveImpactPlanning?.qualifiedReserveSats !== expectedSetupReserveSats) {
      findings.push(
        `${packet.packetId}: higher-value ready packet reserve planning sats must use decimal-safe revenue plan math`
      );
    }
  }
  const reserveImpact = packet.reserveImpactPlanning;
  if (!reserveImpact || typeof reserveImpact !== 'object') {
    findings.push(`${packet.packetId}: ready packet must expose planning reserve impact`);
  } else {
    if (reserveImpact.basis !== 'planning-only') {
      findings.push(`${packet.packetId}: reserve impact must be planning-only`);
    }
    if (reserveImpact.reserveAllocationPercent !== '70') {
      findings.push(
        `${packet.packetId}: reserve impact must use the 70 percent BTC reserve allocation policy`
      );
    }
    if (!/operator planning assumption/i.test(reserveImpact.btcUsdSource ?? '')) {
      findings.push(
        `${packet.packetId}: reserve impact must identify BTC/USD as an operator planning assumption`
      );
    }
    if (
      !Number.isSafeInteger(Number(reserveImpact.currentAskReserveSats)) ||
      Number(reserveImpact.currentAskReserveSats) <= 0
    ) {
      findings.push(`${packet.packetId}: reserve impact must include current-ask reserve sats`);
    }
    if (
      !Number.isSafeInteger(Number(reserveImpact.qualifiedReserveSats)) ||
      Number(reserveImpact.qualifiedReserveSats) < Number(reserveImpact.currentAskReserveSats)
    ) {
      findings.push(
        `${packet.packetId}: qualified reserve sats must be at or above current-ask reserve sats`
      );
    }
    if (!/planning only/i.test(reserveImpact.actualSatsRule ?? '')) {
      findings.push(`${packet.packetId}: reserve impact must preserve actual-sats recording rule`);
    }
  }
  if (!packet.message.includes('No price promotion')) {
    findings.push(`${packet.packetId}: ready message must preserve no-price-promotion language`);
  }
  if (!/mark-sent --packet/.test(packet.recordContactCommand ?? '')) {
    findings.push(`${packet.packetId}: ready packet must include a post-send evidence command`);
  }
  if (
    !/outreach-contact-evidence-agent\.mjs render-template --packet/.test(
      packet.evidenceIssueTemplateCommand ?? ''
    )
  ) {
    findings.push(
      `${packet.packetId}: ready packet must include a contact evidence issue template command`
    );
  }
  if (packet.evidenceReviewCommand !== EVIDENCE_REVIEW_COMMAND) {
    findings.push(
      `${packet.packetId}: ready packet must expose the contact evidence review command`
    );
  }
  if (!packet.evidenceIssueTemplateCommand?.includes(`--packet ${packet.packetId}`)) {
    findings.push(`${packet.packetId}: evidence issue template command must target the packet`);
  }
  if (!/--sentAtUtc "<sent-at-utc>"/.test(packet.recordContactCommand ?? '')) {
    findings.push(
      `${packet.packetId}: post-send evidence command must require explicit sentAtUtc evidence`
    );
  }
  if (!/--messageHash [0-9a-f]{64}\b/.test(packet.recordContactCommand ?? '')) {
    findings.push(
      `${packet.packetId}: post-send evidence command must require approved message SHA-256`
    );
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
    if (!/#invoice-ready-intake\b/i.test(packet.tracking.serviceUrl ?? '')) {
      findings.push(`${packet.packetId}: tracking.serviceUrl must target invoice-ready intake`);
    }
  }
  if (!/utm_source=manual_outreach/i.test(packet.message ?? '')) {
    findings.push(
      `${packet.packetId}: ready packet message must include tracked manual_outreach URLs`
    );
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
if (!markdown.includes('## Next Manual Send Sheet')) {
  findings.push('markdown brief must include next manual send sheet section');
}
if (!markdown.includes('Exact approved message:')) {
  findings.push('markdown next manual send sheet must expose exact approved message');
}
if (!markdown.includes('Contact evidence issue body template:')) {
  findings.push('markdown next manual send sheet must expose contact evidence issue body template');
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
if (
  !markdown.includes('Tracked service: https://') ||
  !markdown.includes('utm_source=manual_outreach')
) {
  findings.push('markdown brief must include structured tracked service URLs');
}
if (!markdown.includes('Prepare the contact evidence issue body after manual send')) {
  findings.push('markdown brief must include the contact evidence issue-body helper');
}
if (!markdown.includes('Evidence review command:')) {
  findings.push('markdown brief must include the contact evidence review command');
}
if (!markdown.includes(EVIDENCE_REVIEW_COMMAND)) {
  findings.push('markdown brief must include the outreach contact evidence review plan command');
}
if (!/submit the evidence issue, review it, and record only/i.test(markdown)) {
  findings.push('markdown brief must require evidence review before mark-sent');
}
if (!markdown.includes('Current approved ask:')) {
  findings.push('markdown must separate the current approved ask from the qualified revenue path');
}
if (!markdown.includes('Planning reserve impact:')) {
  findings.push('markdown must expose per-packet planning reserve impact');
}
if (
  !markdown.includes('Planning BTC/USD source: operator planning assumption, not a live quote.')
) {
  findings.push('markdown must expose the sprint BTC/USD planning source');
}
if (!markdown.includes('Planning basis: 70% reserve allocation at BTC/USD 100000')) {
  findings.push('markdown must expose the reserve-impact planning basis');
}
if (!markdown.includes('Upgrade path:')) {
  findings.push('markdown must expose the explicit-fit upgrade path');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|pump)\b/i.test(markdown)) {
  findings.push('dispatch brief must not include prohibited or secret-requesting language');
}
if (/record durable evidence|then record contact evidence/i.test(markdown)) {
  findings.push('dispatch brief must require evidence review before mark-sent');
}
const issueCommandIndex = markdown.indexOf(
  'Prepare the contact evidence issue body after manual send:'
);
const reviewCommandIndex = markdown.indexOf(EVIDENCE_REVIEW_COMMAND);
const markSentCommandIndex = markdown.indexOf(
  'node scripts/service-outreach-packet-agent.mjs mark-sent'
);
if (issueCommandIndex === -1 || reviewCommandIndex === -1 || markSentCommandIndex === -1) {
  findings.push(
    'markdown must present outreach issue-body, evidence review, and mark-sent commands'
  );
} else {
  if (issueCommandIndex > reviewCommandIndex) {
    findings.push('markdown must present outreach issue-body command before evidence review');
  }
  if (reviewCommandIndex > markSentCommandIndex) {
    findings.push('markdown must present outreach evidence review before mark-sent');
  }
}
for (const command of markdown.match(
  /node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g
) ?? []) {
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
      findings.push(
        `${packet.packetId}: public post-send evidence command must require approved message SHA-256`
      );
    }
    if (
      !/outreach-contact-evidence-agent\.mjs render-template --packet/.test(
        packet.evidenceIssueTemplateCommand ?? ''
      )
    ) {
      findings.push(
        `${packet.packetId}: public ready packet must include contact evidence issue template command`
      );
    }
    if (packet.evidenceReviewCommand !== EVIDENCE_REVIEW_COMMAND) {
      findings.push(
        `${packet.packetId}: public ready packet must expose the contact evidence review command`
      );
    }
  }
}
if (publicMarkdown && !publicBrief) {
  findings.push('public outreach-dispatch-brief.md requires matching outreach-dispatch-brief.json');
}
if (publicMarkdown) {
  for (const command of publicMarkdown.match(
    /node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g
  ) ?? []) {
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
