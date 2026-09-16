import { buildInboundReplyTriage } from './inbound-reply-triage.mjs';

const FIELD_LABELS = {
  sourceType: 'Source type',
  sourceId: 'Source ID',
  contactHandle: 'Contact handle',
  publicProfileUrl: 'Public profile URL',
  projectUrl: 'Project URL',
  requestedOfferId: 'Requested offer ID',
  exactReplyText: 'Exact reply text',
  replyEvidenceUrl: 'Reply evidence URL or reference',
  recordedAtUtc: 'Recorded at UTC',
  classification: 'Classification',
  customerAskedForInvoice: 'Customer asked for invoice'
};

const REQUIRED_FIELDS = Object.keys(FIELD_LABELS);
const RECORDABLE_CLASSIFICATIONS = new Set([
  'invoice-request-needs-chairman-review',
  'needs-intake-fields'
]);
const PROHIBITED_PATTERN =
  /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|market support|investment return|private key|seed phrase|payment address|send payment)\b/i;

export function parseInboundReplyEvidenceIssueBody(body) {
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

export function buildInboundReplyEvidenceDraft({ issue, queue }) {
  if (!queue) throw new Error('Missing inbound service lead queue.');
  const intake = parseInboundReplyEvidenceIssueBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !intake[field]);
  const findings = [];

  if (missingRequiredFields.length > 0) {
    findings.push(`Missing required fields: ${missingRequiredFields.join(', ')}`);
  }
  if (intake.replyEvidenceUrl && intake.replyEvidenceUrl.length < 8) {
    findings.push('Reply evidence must be a durable reference.');
  }
  if (!/^(true|false)$/i.test(intake.customerAskedForInvoice)) {
    findings.push('Customer asked for invoice must be true or false.');
  }
  if (intake.recordedAtUtc && Number.isNaN(new Date(intake.recordedAtUtc).getTime())) {
    findings.push('recordedAtUtc must be a valid ISO timestamp.');
  }
  if (hasProhibitedPositiveClaims(intake.exactReplyText)) {
    findings.push('Exact reply text contains prohibited or secret-requesting language.');
  }

  let triage = null;
  if (findings.length === 0 && missingRequiredFields.length === 0) {
    try {
      triage = buildInboundReplyTriage({
        queue,
        sourceType: intake.sourceType,
        sourceId: intake.sourceId,
        contactHandle: intake.contactHandle,
        publicProfileUrl: intake.publicProfileUrl,
        projectUrl: intake.projectUrl,
        offer: intake.requestedOfferId,
        replyText: intake.exactReplyText,
        evidence: intake.replyEvidenceUrl || issueUrl,
        recordedAtUtc: intake.recordedAtUtc
      });
    } catch (error) {
      findings.push(error.message);
    }
  }

  if (triage) {
    if (triage.classification !== intake.classification) {
      findings.push(
        `Classification mismatch: issue says ${intake.classification}, triage returns ${triage.classification}.`
      );
    }
    const issueAskedForInvoice = /^true$/i.test(intake.customerAskedForInvoice);
    if (triage.customerAskedForInvoice !== issueAskedForInvoice) {
      findings.push(
        `Customer asked for invoice mismatch: issue says ${issueAskedForInvoice}, triage returns ${triage.customerAskedForInvoice}.`
      );
    }
  }

  const recordable =
    Boolean(triage) &&
    RECORDABLE_CLASSIFICATIONS.has(triage.classification) &&
    triage.recordable === true;
  const operatorCommand = findings.length === 0 && recordable ? triage.recordLeadCommand : null;

  return {
    project: queue.project,
    mode: 'inbound-reply-evidence-intake',
    intake,
    issueUrl,
    missingRequiredFields,
    triage: triage
      ? {
          classification: triage.classification,
          recordable: triage.recordable,
          leadStatus: triage.leadStatus,
          customerAskedForInvoice: triage.customerAskedForInvoice,
          replyTemplateId: triage.replyTemplateId,
          replyTemplateText: triage.replyTemplateText,
          nextCommandAfterRecord: triage.nextCommandAfterRecord,
          nextAction: triage.nextAction
        }
      : null,
    readyToRecord: findings.length === 0 && recordable,
    operatorCommand,
    findings,
    nextRequiredAction:
      findings.length === 0 && recordable
        ? 'Authorized human may run the operator command to record the inbound lead evidence.'
        : findings.length === 0
          ? 'No lead record should be created from this reply; keep monitoring or close the evidence issue.'
          : 'Fix the inbound reply evidence issue before recording or closing the reply.',
    boundary:
      'This intake prepares a local evidence-recording command only when the reply is recordable. It does not contact leads, approve invoices, send payment instructions, grant tokens, publish posts, approve compensation, or move assets.'
  };
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
    /\b(no|not|without|do not|must not|does not|block(?:s)?|reject(?:s)?|cannot help with|before separate Executive Chairman approval)[^.;\n]*(?:price guarantee|redemption promise|market-support|market support|guaranteed buyers|fake engagement|bots|raids|investment return|payment instruction|payment address|asset movement|token grant|compensation)[^.;\n]*/gi,
    ''
  );
  return PROHIBITED_PATTERN.test(cleaned);
}
