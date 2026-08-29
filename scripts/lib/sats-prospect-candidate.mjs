export function buildProspectCandidate({
  pipeline,
  id,
  source = 'manual-public-review',
  publicProfileUrl,
  projectUrl,
  observedClaim,
  recommendedOfferId,
  evidence,
  notes
}) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const candidate = {
    id: cleanId(id),
    stage: 'identified',
    source: cleanLine(source),
    publicProfileUrl: cleanUrl(publicProfileUrl, 'publicProfileUrl'),
    projectUrl: cleanUrl(projectUrl, 'projectUrl'),
    observedClaim: cleanLine(observedClaim),
    recommendedOfferId: cleanLine(recommendedOfferId ?? pipeline.primaryOfferId),
    chairmanApprovedBeforeOutreach: false,
    evidence: normalizeEvidence(evidence),
    notes: cleanLine(notes ?? 'Draft candidate only. Executive Chairman approval is required before outreach.')
  };

  assertProspectCandidate({ pipeline, candidate });
  return candidate;
}

export function assertProspectCandidate({ pipeline, candidate }) {
  const label = candidate?.id ?? '<missing-candidate>';
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  if (!candidate) throw new Error('Missing prospect candidate.');
  for (const field of pipeline.requiredLeadFields ?? []) {
    if (candidate[field] === undefined || candidate[field] === '') {
      throw new Error(`${label}: missing required prospect field ${field}.`);
    }
  }
  if (candidate.stage !== 'identified') {
    throw new Error(`${label}: drafted candidates must start at identified until chairman review.`);
  }
  if (candidate.chairmanApprovedBeforeOutreach !== false) {
    throw new Error(`${label}: chairmanApprovedBeforeOutreach must be false for drafts.`);
  }
  if (!(pipeline.leadStages ?? []).includes(candidate.stage)) {
    throw new Error(`${label}: stage must exist in leadStages.`);
  }
  const allowedOffers = new Set([
    pipeline.primaryOfferId,
    ...(pipeline.idealCustomerProfile ?? []).map((profile) => profile.bestOfferId),
    ...(pipeline.approvedOutreachTemplates ?? []).map((template) => template.offerId)
  ]);
  if (!allowedOffers.has(candidate.recommendedOfferId)) {
    throw new Error(`${label}: recommendedOfferId must match an approved revenue offer.`);
  }
  for (const field of ['publicProfileUrl', 'projectUrl']) {
    if (!/^https:\/\/\S+\.\S+/.test(candidate[field])) {
      throw new Error(`${label}: ${field} must be an https URL.`);
    }
  }
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
    throw new Error(`${label}: evidence must include at least one public link or note.`);
  }
  for (const value of [candidate.source, candidate.notes]) {
    if (/\bpump\b|guaranteed buyers|fake engagement|\bbots\b|\braids\b|price prediction/i.test(value)) {
      throw new Error(`${label}: draft language contains prohibited sales wording.`);
    }
  }
  if (!candidate.observedClaim || candidate.observedClaim.length < 12) {
    throw new Error(`${label}: observedClaim must explain the public evidence gap.`);
  }
  return true;
}

function normalizeEvidence(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(',');
  return items.map((item) => cleanLine(item)).filter(Boolean);
}

function cleanId(value) {
  const id = cleanLine(value).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) throw new Error('Prospect id is required.');
  return id;
}

function cleanUrl(value, label) {
  const url = cleanLine(value);
  if (!url) throw new Error(`${label} is required.`);
  return url;
}

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
