const INVOICE_REQUEST_PATTERN =
  /\b(invoice|pay|payment|payment method|where (?:do|can) i send|send (?:the )?(?:btc|bitcoin|usdc|sol)|ready to (?:pay|start)|let'?s do it|start the audit|move forward)\b/i;
const SERVICE_INTEREST_PATTERN =
  /\b(audit|transparency|report|dashboard|proof|authority|liquidity|reserve|disclosure|claims?|token|contract|website|interested|need this|how (?:does|would) this work)\b/i;
const PROHIBITED_PATTERN =
  /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|market support|investment return)\b/i;

export function buildInboundReplyTriage({
  queue,
  sourceType,
  sourceId,
  contactHandle,
  publicProfileUrl,
  projectUrl,
  offer = 'transparency-audit',
  replyText,
  evidence,
  recordedAtUtc = '<recorded-at-utc>',
  generatedAtUtc = new Date().toISOString()
}) {
  if (!queue || typeof queue !== 'object') throw new Error('Missing inbound lead queue.');
  const reply = cleanMultiline(replyText);
  if (!reply) throw new Error('replyText is required.');

  const classification = classifyReply(reply);
  const template = selectReplyTemplate(queue, classification.replyTemplateId);
  const inputSummary = {
    sourceType: cleanLine(sourceType),
    sourceId: cleanLine(sourceId),
    contactHandle: cleanLine(contactHandle),
    publicProfileUrl: cleanLine(publicProfileUrl),
    projectUrl: cleanLine(projectUrl),
    requestedOfferId: cleanLine(offer || 'transparency-audit'),
    evidence: cleanLine(evidence),
    recordedAtUtc: cleanLine(recordedAtUtc)
  };

  const leadId = kebab(inputSummary.contactHandle || inputSummary.sourceId);
  const recordLeadCommand =
    classification.recordable === true
      ? buildRecordLeadCommand({
          leadId,
          inputSummary,
          customerAskedForInvoice: classification.customerAskedForInvoice
        })
      : null;

  return {
    project: queue.project,
    mode: 'inbound-reply-triage',
    generatedAtUtc,
    classification: classification.id,
    recordable: classification.recordable,
    leadStatus: classification.leadStatus,
    customerAskedForInvoice: classification.customerAskedForInvoice,
    inputSummary,
    replyTemplateId: classification.replyTemplateId,
    replyTemplateText: template.text,
    recordLeadCommand,
    nextAction: classification.nextAction,
    stopRules: [
      'Do not send payment instructions from triage.',
      'Do not record an invoice request unless the customer explicitly asks for an invoice or payment method.',
      'Do not continue prohibited pump, fake-engagement, buyer, price, redemption, return, or market-support requests.',
      'Exact-sats invoices require separate Executive Chairman approval before sending.'
    ],
    boundary:
      'This triage result classifies reply evidence only. It does not contact the lead, approve an invoice, reveal payment instructions, start paid work, grant tokens, control custody, or move assets.'
  };
}

export function renderInboundReplyTriage(triage) {
  const lines = [
    '# SATA Inbound Reply Triage',
    '',
    `Generated: ${triage.generatedAtUtc}`,
    `Classification: ${triage.classification}`,
    `Recordable: ${triage.recordable ? 'yes' : 'no'}`,
    `Lead status: ${triage.leadStatus}`,
    `Customer asked for invoice: ${triage.customerAskedForInvoice ? 'yes' : 'no'}`,
    '',
    '## Suggested Reply',
    '',
    triage.replyTemplateText,
    '',
    '## Record Command'
  ];

  if (triage.recordLeadCommand) {
    lines.push('', '```sh', triage.recordLeadCommand, '```');
  } else {
    lines.push('', 'Do not record this as a service lead. Close or ignore unless the human has separate evidence of legitimate service interest.');
  }

  lines.push('', '## Next Action', '', triage.nextAction, '', '## Stop Rules');
  for (const rule of triage.stopRules) lines.push(`- ${rule}`);
  lines.push('', '## Boundary', '', triage.boundary);
  return `${lines.join('\n')}\n`;
}

function classifyReply(reply) {
  if (PROHIBITED_PATTERN.test(reply)) {
    return {
      id: 'reject-prohibited-promotion',
      recordable: false,
      leadStatus: 'closed-invalid',
      customerAskedForInvoice: false,
      replyTemplateId: 'reject-prohibited-promotion',
      nextAction:
        'Do not continue the promotional request. A human may send the rejection template if useful, with no invoice or payment instructions.'
    };
  }
  if (INVOICE_REQUEST_PATTERN.test(reply)) {
    return {
      id: 'invoice-request-needs-chairman-review',
      recordable: true,
      leadStatus: 'invoice-requested-needs-chairman-review',
      customerAskedForInvoice: true,
      replyTemplateId: 'invoice-request-boundary',
      nextAction:
        'Record the lead with invoice-request evidence, render the inbound invoice request packet, then wait for Executive Chairman approval before any payment instructions.'
    };
  }
  if (SERVICE_INTEREST_PATTERN.test(reply)) {
    return {
      id: 'needs-intake-fields',
      recordable: true,
      leadStatus: 'needs-intake',
      customerAskedForInvoice: false,
      replyTemplateId: 'request-intake-fields',
      nextAction:
        'Record the lead as needing intake, send the intake-fields reply manually, and wait for enough project details before invoice review.'
    };
  }
  return {
    id: 'monitor-no-service-intent',
    recordable: false,
    leadStatus: 'closed-invalid',
    customerAskedForInvoice: false,
    replyTemplateId: 'monitor-no-service-intent',
    nextAction:
      'Do not record a revenue lead yet. Continue monitoring until the reply shows service interest or an explicit invoice request.'
  };
}

function selectReplyTemplate(queue, id) {
  const existing = (queue.replyTemplates ?? []).find((template) => template.id === id);
  if (existing) return existing;
  if (id === 'reject-prohibited-promotion') {
    return {
      id,
      text:
        'SATA cannot help with pump marketing, fake engagement, investor targeting, buyer claims, price promises, redemption promises, or market-support commitments. We only consider legitimate transparency-service work with clear disclosure and Executive Chairman approval.'
    };
  }
  return {
    id,
    text:
      'Thanks. I will keep monitoring for a concrete transparency-service request. No invoice or payment instructions are sent without Executive Chairman approval.'
  };
}

function buildRecordLeadCommand({ leadId, inputSummary, customerAskedForInvoice }) {
  return [
    'node scripts/inbound-service-lead-agent.mjs record-lead',
    `--lead ${quote(leadId || '<lead-id>')}`,
    `--sourceType ${quote(inputSummary.sourceType || '<source-type>')}`,
    `--sourceId ${quote(inputSummary.sourceId || '<source-id>')}`,
    `--contactHandle ${quote(inputSummary.contactHandle || '<contact-handle>')}`,
    `--publicProfileUrl ${quote(inputSummary.publicProfileUrl || '<https-profile-url>')}`,
    `--projectUrl ${quote(inputSummary.projectUrl || '<https-project-url>')}`,
    `--offer ${quote(inputSummary.requestedOfferId || 'transparency-audit')}`,
    `--evidence ${quote(inputSummary.evidence || '<reply-or-dm-evidence>')}`,
    `--customerAskedForInvoice ${customerAskedForInvoice ? 'true' : 'false'}`,
    `--recordedAtUtc ${quote(inputSummary.recordedAtUtc || '<recorded-at-utc>')}`
  ].join(' ');
}

function quote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function kebab(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMultiline(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
