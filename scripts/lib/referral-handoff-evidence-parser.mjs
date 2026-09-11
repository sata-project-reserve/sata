import { buildReferralPartnerHandoffPlan } from './referral-partner-handoffs.mjs';

const FIELD_LABELS = {
  campaignId: 'Source campaign ID',
  partnerHandle: 'Partner handle',
  sentEvidenceUrl: 'Sent evidence URL or reference',
  approvedTermsSha256: 'Approved terms SHA-256',
  exactTermsSent: 'Exact referral terms sent',
  sentAtUtc: 'Sent at UTC'
};

const REQUIRED_FIELDS = [
  'campaignId',
  'partnerHandle',
  'sentEvidenceUrl',
  'approvedTermsSha256',
  'exactTermsSent',
  'sentAtUtc'
];

export function parseReferralHandoffEvidenceIssueBody(body) {
  const sections = {};
  let currentLabel = null;
  let currentLines = [];

  for (const line of String(body).replace(/\r/g, '').split('\n')) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      flushSection();
      currentLabel = normalizeLabel(heading[1]);
      currentLines = [];
    } else if (currentLabel) {
      currentLines.push(line);
    }
  }
  flushSection();

  return Object.fromEntries(
    Object.entries(FIELD_LABELS).map(([field, label]) => [
      field,
      sections[normalizeLabel(label)] ?? ''
    ])
  );

  function flushSection() {
    if (!currentLabel) return;
    sections[currentLabel] = cleanValue(currentLines.join('\n'));
  }
}

export function buildReferralHandoffEvidenceDraft({
  issue,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
}) {
  const intake = parseReferralHandoffEvidenceIssueBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !intake[field]);
  const plan = buildReferralPartnerHandoffPlan({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue
  });
  const candidate =
    plan.candidates.find((item) => item.sourceCampaignId === intake.campaignId) ?? null;
  const findings = [];

  if (missingRequiredFields.length > 0) {
    findings.push(`Missing required fields: ${missingRequiredFields.join(', ')}`);
  }
  if (!candidate) {
    findings.push(`Referral handoff candidate not found: ${intake.campaignId || '<missing>'}`);
  }
  if (
    candidate &&
    cleanHandle(candidate.partner.handle).toLowerCase() !== cleanHandle(intake.partnerHandle).toLowerCase()
  ) {
    findings.push(`Partner handle mismatch: ${intake.partnerHandle} does not match ${candidate.partner.handle}`);
  }
  if (
    candidate &&
    intake.exactTermsSent &&
    normalizeMessage(candidate.packet.replyTemplate) !== normalizeMessage(intake.exactTermsSent)
  ) {
    findings.push('Exact referral terms sent do not match the approved handoff packet.');
  }
  if (intake.approvedTermsSha256 && !/^[a-f0-9]{64}$/.test(intake.approvedTermsSha256)) {
    findings.push('Approved terms SHA-256 must be a 64-character lowercase hex digest.');
  }
  if (
    candidate &&
    intake.approvedTermsSha256 &&
    intake.approvedTermsSha256 !== candidate.packet.termsSha256
  ) {
    findings.push('Approved terms SHA-256 does not match the approved handoff packet.');
  }
  if (hasProhibitedPositiveClaims(intake.exactTermsSent)) {
    findings.push('Exact referral terms contain prohibited or secret-requesting language.');
  }
  if (intake.sentAtUtc && Number.isNaN(new Date(intake.sentAtUtc).getTime())) {
    findings.push('Sent at UTC must be a valid ISO timestamp.');
  }

  const operatorCommand =
    findings.length === 0
      ? buildRecordSentCommand({
          campaignId: candidate.sourceCampaignId,
          evidence: intake.sentEvidenceUrl || issueUrl,
          sentAtUtc: intake.sentAtUtc,
          messageHash: candidate.packet.termsSha256
        })
      : null;

  return {
    project: queue.project,
    mode: 'referral-handoff-evidence-intake',
    intake,
    issueUrl,
    missingRequiredFields,
    matchedCandidate: candidate
      ? {
          sourceCampaignId: candidate.sourceCampaignId,
          partner: candidate.partner,
          sourceEvidence: candidate.sourceEvidence
        }
      : null,
    termsMatchApprovedPacket:
      Boolean(candidate && intake.exactTermsSent) &&
      normalizeMessage(candidate.packet.replyTemplate) === normalizeMessage(intake.exactTermsSent),
    hashMatchesApprovedPacket:
      Boolean(candidate && intake.approvedTermsSha256) &&
      intake.approvedTermsSha256 === candidate.packet.termsSha256,
    readyToRecord: findings.length === 0,
    operatorCommand,
    findings,
    nextRequiredAction:
      findings.length === 0
        ? 'Authorized human may run the operator command to record referral handoff sent evidence.'
        : 'Fix the referral handoff evidence issue before recording terms as sent.',
    boundary:
      'This intake prepares a local evidence-recording command only. It does not send referral terms, approve partners, approve compensation, send invoices, send payment instructions, grant tokens, publish posts, or move assets.'
  };
}

function buildRecordSentCommand({ campaignId, evidence, sentAtUtc, messageHash }) {
  const parts = [
    'node scripts/referral-partner-handoff-agent.mjs record-sent',
    `--campaign ${campaignId}`,
    `--evidence "${escapeCommandValue(evidence)}"`
  ];
  if (cleanLine(sentAtUtc)) {
    parts.push(`--sentAtUtc "${escapeCommandValue(sentAtUtc)}"`);
  }
  if (cleanLine(messageHash)) {
    parts.push(`--messageHash ${escapeCommandValue(messageHash)}`);
  }
  return parts.join(' ');
}

function normalizeLabel(value) {
  return String(value).trim().toLowerCase();
}

function cleanValue(value) {
  return String(value)
    .replace(/\r/g, '')
    .trim()
    .replace(/^_No response_$/i, '')
    .trim();
}

function cleanHandle(value) {
  return cleanLine(value).replace(/^@/, '');
}

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeMessage(value) {
  return String(value ?? '').replace(/\r/g, '').trim();
}

function hasProhibitedPositiveClaims(text) {
  const cleaned = cleanLine(text).replace(
    /\b(no|not|without|do not|must not|does not|block(?:s)?|before separate Executive Chairman approval)[^.;\n]*(?:price guarantee|redemption promise|market-support|guaranteed buyers|fake engagement|bots|raids|investment return|payment instruction|asset movement|token grant|compensation)[^.;\n]*/gi,
    ''
  );
  return /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|investment return|private key|seed phrase|payment address|send payment)\b/i.test(
    cleaned
  );
}

function escapeCommandValue(value) {
  return cleanLine(value).replaceAll('"', '\\"');
}
