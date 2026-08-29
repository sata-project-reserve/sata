const CONTACTED_STAGES = new Set(['contacted', 'invoice-requested', 'paid', 'delivered']);
const INVOICE_REQUESTED_STAGES = new Set(['invoice-requested', 'paid', 'delivered']);

export function buildProspectResponsePlan({ pipeline }) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const prospects = pipeline.prospects ?? [];
  const outreachApproved = prospects
    .filter((prospect) => prospect.stage === 'outreach-approved')
    .map(summaryForPlan);
  const contacted = prospects.filter((prospect) => prospect.stage === 'contacted').map(summaryForPlan);

  return {
    project: pipeline.project,
    mode: 'prospect-response-transition-planner',
    outreachApproved,
    contacted,
    blocked: outreachApproved.length === 0 && contacted.length === 0,
    nextAction:
      outreachApproved.length > 0
        ? `Record contact evidence for ${outreachApproved[0].id} after approved outreach is sent.`
        : contacted.length > 0
          ? `Wait for explicit invoice request evidence from ${contacted[0].id}.`
          : 'Wait for chairman-approved outreach before recording contact or invoice-request evidence.',
    boundary:
      'This planner records evidence after approved manual actions. It does not approve outreach, invoices, payment instructions, custody changes, paid work, token grants, or asset movement.'
  };
}

export function recordProspectContact({
  pipeline,
  prospectId,
  contactEvidence,
  contactChannel = 'manual-dm-or-email',
  contactedAtUtc = new Date().toISOString()
}) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const evidence = requireEvidence(contactEvidence, 'Contact evidence is required.');
  return updateProspect({ pipeline, prospectId }, (prospect) => {
    if (prospect.stage !== 'outreach-approved') {
      throw new Error(`${prospect.id}: contact recording requires outreach-approved stage.`);
    }
    requireApprovedOutreachPath(prospect);
    return {
      ...prospect,
      stage: 'contacted',
      contact: {
        channel: cleanLine(contactChannel),
        evidence,
        contactedAtUtc,
        approvedOutreachStage: 'outreach-approved'
      },
      stageUpdatedAtUtc: contactedAtUtc,
      stageNotes:
        'Contact evidence recorded after chairman-approved outreach. Invoice still requires explicit prospect request evidence.'
    };
  });
}

export function recordInvoiceRequest({
  pipeline,
  prospectId,
  requestEvidence,
  requestedOfferId,
  confirmedCustomerRequestedInvoice,
  requestedAtUtc = new Date().toISOString()
}) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  if (confirmedCustomerRequestedInvoice !== true) {
    throw new Error('Invoice request recording requires confirmedCustomerRequestedInvoice=true.');
  }
  const evidence = requireEvidence(requestEvidence, 'Invoice request evidence is required.');
  return updateProspect({ pipeline, prospectId }, (prospect) => {
    if (prospect.stage !== 'contacted') {
      throw new Error(`${prospect.id}: invoice request recording requires contacted stage.`);
    }
    requireApprovedOutreachPath(prospect);
    if (!prospect.contact?.evidence) {
      throw new Error(`${prospect.id}: invoice request recording requires prior contact evidence.`);
    }
    const offerId = cleanLine(requestedOfferId ?? prospect.recommendedOfferId);
    if (!offerId) throw new Error(`${prospect.id}: requested offer id is required.`);
    return {
      ...prospect,
      stage: 'invoice-requested',
      invoiceRequest: {
        requestedOfferId: offerId,
        evidence,
        requestedAtUtc,
        confirmedCustomerRequestedInvoice: true
      },
      stageUpdatedAtUtc: requestedAtUtc,
      stageNotes:
        'Explicit customer invoice request evidence recorded. Exact-sats invoice still requires Executive Chairman approval.'
    };
  });
}

export function validateProspectResponseEvidence({ pipeline }) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const findings = [];
  for (const prospect of pipeline.prospects ?? []) {
    if (CONTACTED_STAGES.has(prospect.stage)) {
      validateContact(prospect, findings);
    }
    if (INVOICE_REQUESTED_STAGES.has(prospect.stage)) {
      validateInvoiceRequest(prospect, findings);
    }
  }
  if (findings.length > 0) {
    throw new Error(`Prospect response evidence is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function updateProspect({ pipeline, prospectId }, updater) {
  const id = cleanLine(prospectId);
  if (!id) throw new Error('Prospect id is required.');
  let found = false;
  const prospects = (pipeline.prospects ?? []).map((prospect) => {
    if (prospect.id !== id) return prospect;
    found = true;
    return updater(prospect);
  });
  if (!found) throw new Error(`Prospect not found: ${id}`);
  return {
    ...pipeline,
    updatedAtUtc: new Date().toISOString(),
    prospects
  };
}

function validateContact(prospect, findings) {
  if (!prospect.contact || typeof prospect.contact !== 'object') {
    findings.push(`${prospect.id}: ${prospect.stage} stage requires contact evidence`);
    return;
  }
  for (const field of ['channel', 'evidence', 'contactedAtUtc']) {
    if (!cleanLine(prospect.contact[field])) {
      findings.push(`${prospect.id}: contact.${field} is required`);
    }
  }
}

function validateInvoiceRequest(prospect, findings) {
  if (!prospect.invoiceRequest || typeof prospect.invoiceRequest !== 'object') {
    findings.push(`${prospect.id}: ${prospect.stage} stage requires invoice request evidence`);
    return;
  }
  for (const field of ['requestedOfferId', 'evidence', 'requestedAtUtc']) {
    if (!cleanLine(prospect.invoiceRequest[field])) {
      findings.push(`${prospect.id}: invoiceRequest.${field} is required`);
    }
  }
  if (prospect.invoiceRequest.confirmedCustomerRequestedInvoice !== true) {
    findings.push(`${prospect.id}: invoiceRequest.confirmedCustomerRequestedInvoice must be true`);
  }
}

function requireApprovedOutreachPath(prospect) {
  if (prospect.chairmanApprovedBeforeOutreach !== true) {
    throw new Error(`${prospect.id}: response recording requires chairman-approved outreach path.`);
  }
}

function requireEvidence(value, message) {
  const evidence = cleanLine(value);
  if (evidence.length < 8) throw new Error(message);
  return evidence;
}

function summaryForPlan(prospect) {
  return {
    id: prospect.id,
    stage: prospect.stage,
    recommendedOfferId: prospect.recommendedOfferId,
    projectUrl: prospect.projectUrl
  };
}

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
