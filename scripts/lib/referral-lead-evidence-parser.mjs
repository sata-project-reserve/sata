const FIELD_LABELS = {
  handoffId: 'Referral handoff ID',
  customerLeadId: 'Customer lead ID',
  customerHandle: 'Customer handle or contact',
  publicProfileUrl: 'Customer public profile URL',
  projectUrl: 'Customer project URL',
  requestedOfferId: 'Requested offer ID',
  referralEvidenceUrl: 'Referral evidence URL or reference',
  customerInterestSummary: 'Customer interest summary',
  customerAskedForInvoice: 'Customer asked for invoice',
  recordedAtUtc: 'Recorded at UTC',
  convertedAtUtc: 'Converted at UTC'
};

const REQUIRED_FIELDS = Object.keys(FIELD_LABELS);
const PROHIBITED_PATTERN =
  /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|market support|investment return|private key|seed phrase|payment address|send payment)\b/i;

export function parseReferralLeadEvidenceIssueBody(body) {
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

export function buildReferralLeadEvidenceDraft({ issue, handoffQueue }) {
  const intake = parseReferralLeadEvidenceIssueBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !intake[field]);
  const handoff = (handoffQueue.handoffs ?? []).find((item) => item.id === intake.handoffId) ?? null;
  const findings = [];

  if (missingRequiredFields.length > 0) {
    findings.push(`Missing required fields: ${missingRequiredFields.join(', ')}`);
  }
  if (!handoff) {
    findings.push(`Referral handoff not found: ${intake.handoffId || '<missing>'}`);
  }
  if (handoff && handoff.status !== 'accepted-awaiting-referred-lead') {
    findings.push(`Referral handoff is not awaiting referred lead evidence: ${handoff.status}`);
  }
  if (intake.customerLeadId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(intake.customerLeadId)) {
    findings.push('Customer lead ID must be kebab-case.');
  }
  for (const field of ['publicProfileUrl', 'projectUrl']) {
    if (intake[field] && !/^https?:\/\/\S+$/i.test(intake[field])) {
      findings.push(`${field} must be an http(s) URL.`);
    }
  }
  if (intake.referralEvidenceUrl && intake.referralEvidenceUrl.length < 8) {
    findings.push('Referral evidence must be a durable reference.');
  }
  if (!/^(true|false)$/i.test(intake.customerAskedForInvoice)) {
    findings.push('Customer asked for invoice must be true or false.');
  }
  for (const field of ['recordedAtUtc', 'convertedAtUtc']) {
    if (intake[field] && Number.isNaN(new Date(intake[field]).getTime())) {
      findings.push(`${field} must be a valid ISO timestamp.`);
    }
  }
  if (!/audit|transparency|report|dashboard|proof|authority|liquidity|reserve|disclosure|claim|token|contract|website|invoice|pay|payment|interested/i.test(intake.customerInterestSummary)) {
    findings.push('Customer interest summary must describe transparency-service interest.');
  }
  if (hasProhibitedPositiveClaims(intake.customerInterestSummary)) {
    findings.push('Customer interest summary contains prohibited or secret-requesting language.');
  }

  const sourceId = handoff ? `referral-partner-${handoff.partner.id}` : '';
  const operatorCommand =
    findings.length === 0
      ? buildRecordLeadCommand({
          leadId: intake.customerLeadId,
          sourceId,
          contactHandle: intake.customerHandle,
          publicProfileUrl: intake.publicProfileUrl,
          projectUrl: intake.projectUrl,
          offer: intake.requestedOfferId,
          evidence: intake.referralEvidenceUrl || issueUrl,
          customerAskedForInvoice: /^true$/i.test(intake.customerAskedForInvoice),
          recordedAtUtc: intake.recordedAtUtc,
          convertedAtUtc: intake.convertedAtUtc
        })
      : null;

  return {
    project: handoffQueue.project,
    mode: 'referral-lead-evidence-intake',
    intake,
    issueUrl,
    missingRequiredFields,
    matchedHandoff: handoff
      ? {
          id: handoff.id,
          sourceCampaignId: handoff.sourceCampaignId,
          partner: handoff.partner,
          status: handoff.status,
          referralSourceId: sourceId
        }
      : null,
    readyToRecord: findings.length === 0,
    operatorCommand,
    findings,
    nextRequiredAction:
      findings.length === 0
        ? 'Authorized human may run the operator command to record the referred inbound lead.'
        : 'Fix the referral lead evidence issue before recording the referred lead.',
    boundary:
      'This intake prepares a local referred-lead recording command only. It does not approve partners, approve compensation, send invoices, send payment instructions, grant tokens, publish posts, or move assets.'
  };
}

function buildRecordLeadCommand({
  leadId,
  sourceId,
  contactHandle,
  publicProfileUrl,
  projectUrl,
  offer,
  evidence,
  customerAskedForInvoice,
  recordedAtUtc,
  convertedAtUtc
}) {
  return [
    'node scripts/inbound-service-lead-agent.mjs record-lead',
    `--lead ${quote(leadId)}`,
    '--sourceType manual-referral',
    `--sourceId ${quote(sourceId)}`,
    `--contactHandle ${quote(contactHandle)}`,
    `--publicProfileUrl ${quote(publicProfileUrl)}`,
    `--projectUrl ${quote(projectUrl)}`,
    `--offer ${quote(offer)}`,
    `--evidence ${quote(evidence)}`,
    `--customerAskedForInvoice ${customerAskedForInvoice ? 'true' : 'false'}`,
    `--recordedAtUtc ${quote(recordedAtUtc)}`,
    `--convertedAtUtc ${quote(convertedAtUtc)}`
  ].join(' ');
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
  return PROHIBITED_PATTERN.test(cleaned);
}

function quote(value) {
  return `"${cleanLine(value).replaceAll('"', '\\"')}"`;
}
