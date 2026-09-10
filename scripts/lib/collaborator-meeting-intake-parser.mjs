const FIELD_LABELS = {
  collaboratorName: 'Collaborator name or handle',
  publicProfileUrl: 'Public profile URL',
  proposedRole: 'Proposed role',
  pastWork: 'Past work evidence',
  requestedTerms: 'Requested terms',
  disclosurePolicy: 'Disclosure policy',
  willingToMeetDubai: 'Willing to meet face-to-face in Dubai',
  meetingNotes: 'Meeting notes'
};

const REQUIRED_FIELDS = [
  'collaboratorName',
  'publicProfileUrl',
  'proposedRole',
  'pastWork',
  'requestedTerms',
  'disclosurePolicy',
  'willingToMeetDubai'
];

const ALLOWED_ROLES = new Set([
  'transparency-service referral',
  'factual media or education coverage',
  'technical proof or reporting contributor',
  'local Dubai collaborator meeting',
  'other'
]);

const ALLOWED_MEETING_VALUES = new Set(['yes-public-place', 'no', 'not-applicable']);

export function parseCollaboratorMeetingIntakeIssueBody(body) {
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

export function buildCollaboratorMeetingIntakeDraft({ issue, policy }) {
  if (!policy) throw new Error('Missing collaborator meeting intake policy.');

  const intake = parseCollaboratorMeetingIntakeIssueBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !intake[field]);
  const findings = [];

  if (missingRequiredFields.length > 0) {
    findings.push(`Missing required fields: ${missingRequiredFields.join(', ')}`);
  }
  if (intake.publicProfileUrl && !/^https?:\/\/\S+$/i.test(intake.publicProfileUrl)) {
    findings.push('Public profile URL must be an HTTP(S) URL.');
  }
  if (intake.proposedRole && !ALLOWED_ROLES.has(intake.proposedRole)) {
    findings.push(`Unsupported proposed role: ${intake.proposedRole}`);
  }
  if (intake.willingToMeetDubai && !ALLOWED_MEETING_VALUES.has(intake.willingToMeetDubai)) {
    findings.push(`Unsupported Dubai meeting value: ${intake.willingToMeetDubai}`);
  }
  if (
    !/Sponsored|Paid Partnership|token-compensated|not compensated|unpaid/i.test(
      intake.disclosurePolicy
    )
  ) {
    findings.push('Disclosure policy must explain paid, token-compensated, or unpaid disclosure.');
  }
  if (
    containsUnsafePositiveClaim(
      [intake.pastWork, intake.requestedTerms, intake.disclosurePolicy, intake.meetingNotes].join(
        '\n'
      )
    )
  ) {
    findings.push(
      'Submission contains prohibited market, fake-engagement, or custody wording outside negative controls.'
    );
  }

  const policyApproved = policy.status === 'approved-by-chairman';
  const meetingRequested = intake.willingToMeetDubai === 'yes-public-place';

  return {
    project: policy.project,
    mode: 'collaborator-meeting-intake-review',
    intake,
    issueUrl,
    policyStatus: policy.status,
    policyApprovalItemId: policy.approvalItemId,
    missingRequiredFields,
    meetingRequested,
    readyForChairmanReview: findings.length === 0,
    readyForScheduling: findings.length === 0 && policyApproved && meetingRequested,
    findings,
    recommendedNextSteps: buildRecommendedNextSteps({ policyApproved, meetingRequested, findings }),
    boundary:
      'This intake prepares a review summary only. It does not approve a collaborator, schedule a meeting, approve compensation, publish posts, issue invoices, send payment instructions, grant tokens, change custody, or move assets.'
  };
}

function buildRecommendedNextSteps({ policyApproved, meetingRequested, findings }) {
  if (findings.length > 0) {
    return ['Request corrected collaborator evidence before chairman review.'];
  }
  const steps = [];
  if (!policyApproved) {
    steps.push(
      'Review and decide the collaborator meeting intake policy before using this path operationally.'
    );
  }
  steps.push(
    'Chairman may reject, request more evidence, or prepare a separate partner-specific proposal.'
  );
  if (meetingRequested) {
    steps.push(
      'If approved separately, schedule only a public-place Dubai meeting with no custody, cash, signing, or asset exchange.'
    );
  }
  steps.push(
    'Compensation remains post-receipt or proposal-only and requires separate chairman approval.'
  );
  return steps;
}

function containsUnsafePositiveClaim(value) {
  const cleaned = String(value ?? '')
    .replace(
      /\b(no|not|without|do not|must not|will not|reject|rejects|prohibit|prohibits)[^.\n]*(?:pump|guaranteed buyers|fake engagement|bots|raids|price claims?|return claims?|market-support|coordinated trading|wallet signing|cash exchange|asset exchange|custody)[^.\n]*/gi,
      ''
    )
    .replace(/\bnot compensated\b/gi, '');

  return /\b(pump|guaranteed buyers|fake engagement|bots|raids|price claims?|return claims?|market-support|coordinated trading|wallet signing|cash exchange|asset exchange|custody handoff)\b/i.test(
    cleaned
  );
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
