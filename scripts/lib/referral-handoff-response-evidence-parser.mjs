const FIELD_LABELS = {
  handoffId: 'Referral handoff ID',
  partnerAccepted: 'Partner accepted terms',
  responseEvidenceUrl: 'Response evidence URL or reference',
  exactResponseSummary: 'Exact response summary',
  respondedAtUtc: 'Responded at UTC'
};

const REQUIRED_FIELDS = [
  'handoffId',
  'partnerAccepted',
  'responseEvidenceUrl',
  'exactResponseSummary',
  'respondedAtUtc'
];

export function parseReferralHandoffResponseEvidenceIssueBody(body) {
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

export function buildReferralHandoffResponseEvidenceDraft({ issue, queue }) {
  const intake = parseReferralHandoffResponseEvidenceIssueBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !intake[field]);
  const handoff = (queue.handoffs ?? []).find((item) => item.id === intake.handoffId) ?? null;
  const findings = [];

  if (missingRequiredFields.length > 0) {
    findings.push(`Missing required fields: ${missingRequiredFields.join(', ')}`);
  }
  if (!handoff) {
    findings.push(`Referral handoff not found: ${intake.handoffId || '<missing>'}`);
  }
  if (handoff && handoff.status !== 'sent-awaiting-response') {
    findings.push(`Referral handoff is not awaiting response: ${handoff.status}`);
  }
  if (!/^(true|false)$/i.test(intake.partnerAccepted)) {
    findings.push('Partner accepted terms must be true or false.');
  }
  if (!/accept|agree|decline|reject|no|yes/i.test(intake.exactResponseSummary)) {
    findings.push('Exact response summary must state whether the partner accepted or declined.');
  }
  if (hasProhibitedPositiveClaims(intake.exactResponseSummary)) {
    findings.push('Exact response summary contains prohibited or secret-requesting language.');
  }
  if (intake.respondedAtUtc && Number.isNaN(new Date(intake.respondedAtUtc).getTime())) {
    findings.push('Responded at UTC must be a valid ISO timestamp.');
  }

  const operatorCommand =
    findings.length === 0
      ? buildRecordResponseCommand({
          handoffId: handoff.id,
          accepted: /^true$/i.test(intake.partnerAccepted),
          evidence: intake.responseEvidenceUrl || issueUrl,
          respondedAtUtc: intake.respondedAtUtc
        })
      : null;

  return {
    project: queue.project,
    mode: 'referral-handoff-response-evidence-intake',
    intake,
    issueUrl,
    missingRequiredFields,
    matchedHandoff: handoff
      ? {
          id: handoff.id,
          sourceCampaignId: handoff.sourceCampaignId,
          partner: handoff.partner,
          status: handoff.status
        }
      : null,
    readyToRecord: findings.length === 0,
    operatorCommand,
    findings,
    nextRequiredAction:
      findings.length === 0
        ? 'Authorized human may run the operator command to record the partner response.'
        : 'Fix the referral handoff response evidence issue before recording the response.',
    boundary:
      'This intake prepares a local response-recording command only. It does not approve partners, approve compensation, send invoices, send payment instructions, grant tokens, publish posts, or move assets.'
  };
}

function buildRecordResponseCommand({ handoffId, accepted, evidence, respondedAtUtc }) {
  const parts = [
    'node scripts/referral-partner-handoff-agent.mjs record-response',
    `--handoff ${handoffId}`,
    `--accepted ${accepted ? 'true' : 'false'}`,
    `--evidence "${escapeCommandValue(evidence)}"`
  ];
  if (cleanLine(respondedAtUtc)) {
    parts.push(`--respondedAtUtc "${escapeCommandValue(respondedAtUtc)}"`);
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

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
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
