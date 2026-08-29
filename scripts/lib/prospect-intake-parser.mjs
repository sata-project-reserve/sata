import { buildProspectCandidate } from './sats-prospect-candidate.mjs';

const FIELD_LABELS = {
  prospectName: 'Prospect name',
  publicProfileUrl: 'Public profile URL',
  projectUrl: 'Project URL',
  observedClaim: 'Observed public claim or evidence gap',
  recommendedOffer: 'Recommended offer',
  evidence: 'Evidence links'
};

export function parseProspectIssueFormBody(body) {
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

export function buildProspectIntakeDraft({ issue, pipeline }) {
  const intake = parseProspectIssueFormBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const issueNumber = issue.number ? String(issue.number) : slugify(intake.prospectName || 'unknown');
  const missingRequiredFields = Object.keys(FIELD_LABELS).filter((field) => !intake[field]);
  const evidence = compact([issueUrl, intake.evidence]);
  const prospectDraft =
    missingRequiredFields.length === 0
      ? buildProspectCandidate({
          pipeline,
          id: `prospect-intake-${issueNumber}`,
          source: issueUrl ? `github-issue:${issueUrl}` : 'github-issue:unknown',
          publicProfileUrl: intake.publicProfileUrl,
          projectUrl: intake.projectUrl,
          observedClaim: intake.observedClaim,
          recommendedOfferId: intake.recommendedOffer,
          evidence,
          notes: 'Prospect candidate from GitHub issue intake. Executive Chairman approval is required before outreach.'
        })
      : null;

  return {
    intake,
    missingRequiredFields,
    prospectDraft,
    nextRequiredAction:
      missingRequiredFields.length > 0
        ? 'Request the missing prospect fields before chairman review.'
        : 'Submit the identified prospect candidate for Executive Chairman review before any outreach.'
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
