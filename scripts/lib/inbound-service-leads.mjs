const ALLOWED_SOURCE_TYPES = new Set([
  'paid-promotion-reply',
  'published-social-reply',
  'x-dm',
  'github-issue',
  'manual-referral'
]);
const ALLOWED_STATUSES = new Set([
  'needs-intake',
  'needs-chairman-review',
  'invoice-requested-needs-chairman-review',
  'closed-invalid'
]);
const PROHIBITED_PATTERN =
  /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|investment return)\b/i;

export function buildInboundLeadPlan({
  queue,
  paidPromotionLedger = { campaigns: [] },
  socialQueue = { posts: [] },
  generatedAtUtc = new Date().toISOString()
}) {
  validateInboundLeadQueue(queue);
  const openLeads = (queue.leads ?? []).filter((lead) => lead.status !== 'closed-invalid');
  const invoiceRequests = openLeads.filter(
    (lead) => lead.status === 'invoice-requested-needs-chairman-review'
  );
  const liveAttributionSources = [
    ...(paidPromotionLedger.campaigns ?? [])
      .filter((campaign) => ['live-verified', 'completed'].includes(campaign.status))
      .map((campaign) => ({
        type: 'paid-promotion-reply',
        id: campaign.id,
        url: campaign.verifiedPostUrl ?? campaign.reportedPostUrl,
        label: `Paid promotion from @${campaign.promoter?.handle}`
      })),
    ...(socialQueue.posts ?? [])
      .filter((post) => post.status === 'published')
      .map((post) => ({
        type: 'published-social-reply',
        id: post.id,
        url: post.postUrl,
        label: `Published @${socialQueue.account?.handle} post ${post.id}`
      }))
  ];

  return {
    project: queue.project,
    mode: 'inbound-service-lead-plan',
    generatedAtUtc,
    totals: {
      liveAttributionSources: liveAttributionSources.length,
      openLeads: openLeads.length,
      invoiceRequestsNeedingChairmanReview: invoiceRequests.length
    },
    liveAttributionSources,
    openLeads: openLeads.map((lead) => ({
      id: lead.id,
      status: lead.status,
      sourceType: lead.sourceType,
      sourceId: lead.sourceId,
      requestedOfferId: lead.requestedOfferId
    })),
    replyTemplates: queue.replyTemplates,
    nextAction:
      invoiceRequests[0]?.id
        ? `Prepare chairman review packet for inbound invoice request ${invoiceRequests[0].id}.`
        : liveAttributionSources[0]?.id
          ? `Monitor ${liveAttributionSources[0].id} for service replies and record qualified inbound evidence.`
          : queue.nextAction,
    boundary: queue.boundary
  };
}

export function recordInboundLead({
  queue,
  leadId,
  sourceType,
  sourceId,
  contactHandle,
  publicProfileUrl,
  projectUrl,
  requestedOfferId = 'transparency-audit',
  evidence,
  customerAskedForInvoice = false,
  notes = '',
  recordedAtUtc = new Date().toISOString()
}) {
  validateInboundLeadQueue(queue);
  const id = kebab(leadId || contactHandle || sourceId);
  if (!id) throw new Error('Inbound lead id is required.');
  if ((queue.leads ?? []).some((lead) => lead.id === id)) {
    throw new Error(`Inbound lead already exists: ${id}`);
  }
  const type = cleanLine(sourceType);
  if (!ALLOWED_SOURCE_TYPES.has(type)) {
    throw new Error(`Unsupported sourceType: ${type}`);
  }
  const lead = {
    id,
    sourceType: type,
    sourceId: cleanLine(sourceId),
    contactHandle: cleanLine(contactHandle),
    publicProfileUrl: cleanUrl(publicProfileUrl, 'publicProfileUrl'),
    projectUrl: cleanUrl(projectUrl, 'projectUrl'),
    requestedOfferId: cleanLine(requestedOfferId),
    evidence: requireEvidence(evidence, 'Inbound lead evidence is required.'),
    status: customerAskedForInvoice
      ? 'invoice-requested-needs-chairman-review'
      : 'needs-intake',
    customerAskedForInvoice: Boolean(customerAskedForInvoice),
    recordedAtUtc,
    notes: cleanLine(notes),
    nextAction: customerAskedForInvoice
      ? 'Prepare chairman review packet before exact-sats invoice or payment instructions.'
      : 'Send the intake-fields reply and wait for enough fields to qualify the lead.'
  };
  const updated = {
    ...queue,
    updatedAtUtc: recordedAtUtc,
    leads: [...(queue.leads ?? []), lead]
  };
  validateInboundLeadQueue(updated);
  return updated;
}

export function validateInboundLeadQueue(queue) {
  const findings = [];
  if (!queue || typeof queue !== 'object') findings.push('queue is required');
  if (queue?.schemaVersion !== 1) findings.push('schemaVersion must be 1');
  if (queue?.mode !== 'inbound-service-lead-control') {
    findings.push('mode must be inbound-service-lead-control');
  }
  if (!/confirmed BTC reserve sats|reserve sats/i.test(queue?.objective ?? '')) {
    findings.push('objective must preserve reserve-sats revenue objective');
  }
  if (!/transparency-audit-intake\.yml/i.test(queue?.intakeUrl ?? '')) {
    findings.push('intakeUrl must link to the transparency audit intake form');
  }
  if (queue?.policy?.chairmanApprovalRequiredBeforeInvoice !== true) {
    findings.push('policy must require chairman approval before invoice');
  }
  if (queue?.policy?.paymentInstructionsAllowed !== false) {
    findings.push('policy must block payment instructions');
  }
  if (queue?.policy?.assetMovementAllowed !== false) {
    findings.push('policy must block asset movement');
  }
  if (!/Executive Chairman approval/i.test(queue?.policy?.requiredBoundary ?? '')) {
    findings.push('policy.requiredBoundary must preserve chairman approval gate');
  }
  for (const required of ALLOWED_SOURCE_TYPES) {
    if (!(queue?.sourceTypes ?? []).includes(required)) {
      findings.push(`sourceTypes missing ${required}`);
    }
  }
  for (const required of ALLOWED_STATUSES) {
    if (!(queue?.leadStatuses ?? []).includes(required)) {
      findings.push(`leadStatuses missing ${required}`);
    }
  }
  for (const field of [
    'id',
    'sourceType',
    'sourceId',
    'contactHandle',
    'publicProfileUrl',
    'projectUrl',
    'requestedOfferId',
    'evidence',
    'status'
  ]) {
    if (!(queue?.requiredLeadFields ?? []).includes(field)) {
      findings.push(`requiredLeadFields missing ${field}`);
    }
  }
  if ((queue?.replyTemplates ?? []).length < 2) {
    findings.push('replyTemplates must include intake and invoice-boundary copy');
  }
  for (const template of queue?.replyTemplates ?? []) {
    if (!template.id || !template.text) {
      findings.push('replyTemplates require id and text');
      continue;
    }
    if (!/Executive Chairman approval|exact BTC invoice/i.test(template.text)) {
      findings.push(`${template.id}: reply template must preserve invoice approval gate`);
    }
    if (!/no price guarantee|Starter audit is \$50/i.test(template.text)) {
      findings.push(`${template.id}: reply template must preserve offer or risk boundary`);
    }
    assertNoProhibitedPositiveClaims(template.text, `${template.id}: reply template`, findings);
  }
  const ids = new Set();
  for (const lead of queue?.leads ?? []) {
    const label = lead.id ?? '<missing-lead>';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label)) {
      findings.push(`${label}: lead id must be kebab-case`);
    }
    if (ids.has(label)) findings.push(`${label}: duplicate lead id`);
    ids.add(label);
    for (const field of queue.requiredLeadFields ?? []) {
      if (!cleanLine(lead[field])) findings.push(`${label}: missing ${field}`);
    }
    if (!ALLOWED_SOURCE_TYPES.has(lead.sourceType)) {
      findings.push(`${label}: unsupported sourceType ${lead.sourceType}`);
    }
    if (!ALLOWED_STATUSES.has(lead.status)) {
      findings.push(`${label}: unsupported status ${lead.status}`);
    }
    if (lead.customerAskedForInvoice === true && lead.status !== 'invoice-requested-needs-chairman-review') {
      findings.push(`${label}: invoice-requesting leads must wait for chairman review`);
    }
    assertNoProhibitedPositiveClaims(
      [lead.notes, lead.nextAction, lead.evidence].join('\n'),
      `${label}: lead text`,
      findings
    );
  }
  if (!/does not approve invoices/i.test(queue?.boundary ?? '')) {
    findings.push('boundary must block invoice approval');
  }
  if (findings.length > 0) {
    throw new Error(`Inbound service lead queue is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function assertNoProhibitedPositiveClaims(text, label, findings) {
  const cleaned = cleanLine(text).replace(
    /\b(no|not|without|do not|must not)\s+(?:include\s+)?(price guarantee|redemption promise|market-support|guaranteed buyers|fake engagement|bots|raids|investment return)\b/gi,
    ''
  );
  if (PROHIBITED_PATTERN.test(cleaned)) {
    findings.push(`${label} contains prohibited promotional wording`);
  }
}

function cleanUrl(value, label) {
  const cleaned = cleanLine(value);
  if (!/^https?:\/\/\S+$/i.test(cleaned)) throw new Error(`${label} must be an http(s) URL.`);
  return cleaned;
}

function requireEvidence(value, message) {
  const evidence = cleanLine(value);
  if (evidence.length < 8) throw new Error(message);
  return evidence;
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
