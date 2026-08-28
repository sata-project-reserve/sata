const FIELD_LABELS = {
  projectName: 'Project name',
  network: 'Network',
  tokenOrContractAddress: 'Token or contract address',
  publicProjectUrl: 'Public project URL',
  publicProfileUrl: 'Public profile URL',
  claimsToReview: 'Claims to review',
  requestedDeliverableVisibility: 'Requested deliverable visibility',
  paymentStatus: 'Payment status',
  evidence: 'Evidence links'
};

export function parseIssueFormBody(body) {
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
    Object.entries(FIELD_LABELS).map(([field, label]) => [field, sections[normalizeLabel(label)] ?? ''])
  );

  function flushSection() {
    if (!currentLabel) return;
    sections[currentLabel] = cleanValue(currentLines.join('\n'));
  }
}

export function buildAuditIntakeDraft({ issue, deliveryKit, prospectPipeline, invoiceQueue }) {
  const intake = parseIssueFormBody(issue.body ?? '');
  const missingRequiredFields = (deliveryKit.requiredClientIntake ?? []).filter(
    (field) => !intake[field]
  );
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const issueNumber = issue.number ? String(issue.number) : slugify(intake.projectName || 'unknown');

  return {
    intake,
    missingRequiredFields,
    prospectDraft: {
      id: `audit-intake-${issueNumber}`,
      stage: 'identified',
      source: issueUrl ? `github-issue:${issueUrl}` : 'github-issue:unknown',
      publicProfileUrl: intake.publicProfileUrl,
      projectUrl: intake.publicProjectUrl,
      observedClaim: intake.claimsToReview,
      recommendedOfferId: deliveryKit.primaryOfferId,
      chairmanApprovedBeforeOutreach: false,
      evidence: compact([issueUrl, intake.tokenOrContractAddress, intake.evidence])
    },
    invoiceDraft: {
      status: 'draft',
      offerId: deliveryKit.primaryOfferId,
      customer: intake.projectName,
      usdPrice: deliveryKit.priceUsd,
      settlementCurrency: invoiceQueue.invoices?.find(
        (invoice) => invoice.offerId === deliveryKit.primaryOfferId
      )?.settlementCurrency,
      paymentAddress: invoiceQueue.paymentPolicy?.reserveAddress,
      amountSats: 'quote-required-before-sending',
      chairmanApprovalRequired: true
    },
    deliveryDraft: {
      title: deliveryKit.deliverableTemplate.title.replace(
        '{projectName}',
        intake.projectName || 'Unnamed Project'
      ),
      format: deliveryKit.deliverableTemplate.format,
      sections: deliveryKit.deliverableTemplate.sections,
      visibility: intake.requestedDeliverableVisibility,
      paymentStatus: intake.paymentStatus
    },
    nextRequiredAction:
      missingRequiredFields.length > 0
        ? 'Request the missing intake fields before chairman review.'
        : 'Submit prospect, scope, and exact BTC invoice quote for Executive Chairman approval.'
  };
}

function normalizeLabel(value) {
  return String(value).trim().toLowerCase();
}

function cleanValue(value) {
  const cleaned = String(value)
    .replace(/\r/g, '')
    .trim()
    .replace(/^_No response_$/i, '');
  return cleaned.trim();
}

function compact(values) {
  return values
    .flatMap((value) => String(value ?? '').split(/\n+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'unknown';
}
