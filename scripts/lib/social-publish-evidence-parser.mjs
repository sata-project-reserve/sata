const FIELD_LABELS = {
  postId: 'Social post ID',
  postUrl: 'Published post URL',
  publicationEvidence: 'Publication evidence URL or reference',
  approvedContentSha256: 'Approved content SHA-256',
  exactPostText: 'Exact post text published',
  publishedAtUtc: 'Published at UTC'
};

const REQUIRED_FIELDS = [
  'postId',
  'postUrl',
  'publicationEvidence',
  'approvedContentSha256',
  'exactPostText',
  'publishedAtUtc'
];

export function parseSocialPublishEvidenceIssueBody(body) {
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

export function buildSocialPublishEvidenceDraft({ issue, socialQueue }) {
  if (!socialQueue) throw new Error('Missing social content queue.');
  const intake = parseSocialPublishEvidenceIssueBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !intake[field]);
  const post = (socialQueue.posts ?? []).find((item) => item.id === intake.postId) ?? null;
  const expectedHash = post?.contentSha256 ?? null;
  const findings = [];

  if (missingRequiredFields.length > 0) {
    findings.push(`Missing required fields: ${missingRequiredFields.join(', ')}`);
  }
  if (!post) {
    findings.push(`Social post not found: ${intake.postId || '<missing>'}`);
  }
  if (post && post.status !== 'approved') {
    findings.push(`Social post is not approved for manual publication recording: ${post.status}`);
  }
  if (post && intake.exactPostText && normalizeMessage(post.text) !== normalizeMessage(intake.exactPostText)) {
    findings.push('Exact post text published does not match the approved social queue post.');
  }
  if (intake.approvedContentSha256 && !/^[a-f0-9]{64}$/.test(intake.approvedContentSha256)) {
    findings.push('Approved content SHA-256 must be a 64-character lowercase hex digest.');
  }
  if (post && intake.approvedContentSha256 && expectedHash && intake.approvedContentSha256 !== expectedHash) {
    findings.push('Approved content SHA-256 does not match the approved social queue post.');
  }
  if (intake.postUrl && !canonicalPostUrlPattern(socialQueue.account?.handle).test(intake.postUrl)) {
    findings.push(`Published post URL must match https://x.com/${socialQueue.account?.handle}/status/<numeric-id>.`);
  }
  if (intake.publishedAtUtc && Number.isNaN(new Date(intake.publishedAtUtc).getTime())) {
    findings.push('Published at UTC must be a valid timestamp.');
  }
  if (hasUnsafePositiveClaims(intake.exactPostText)) {
    findings.push('Exact post text contains prohibited or secret-requesting language.');
  }

  const operatorCommand =
    findings.length === 0
      ? buildRecordPublishedCommand({
          postId: post.id,
          postUrl: intake.postUrl,
          evidence: intake.publicationEvidence || issueUrl,
          publishedAtUtc: intake.publishedAtUtc,
          contentHash: expectedHash
        })
      : null;

  return {
    project: socialQueue.project,
    mode: 'social-publish-evidence-intake',
    intake,
    issueUrl,
    missingRequiredFields,
    matchedPost: post
      ? {
          id: post.id,
          status: post.status,
          type: post.type,
          contentSha256: post.contentSha256
        }
      : null,
    textMatchesApprovedPost:
      Boolean(post && intake.exactPostText) &&
      normalizeMessage(post.text) === normalizeMessage(intake.exactPostText),
    hashMatchesApprovedPost:
      Boolean(post && intake.approvedContentSha256 && expectedHash) &&
      intake.approvedContentSha256 === expectedHash,
    readyToRecord: findings.length === 0,
    operatorCommand,
    findings,
    nextRequiredAction:
      findings.length === 0
        ? 'Authorized human may run the operator command to record the approved social post as published.'
        : 'Fix the social publish evidence issue before recording publication.',
    boundary:
      'This intake prepares a local evidence-recording command only. It does not publish posts, approve posts, contact anyone, issue invoices, grant tokens, or move assets.'
  };
}

function buildRecordPublishedCommand({ postId, postUrl, evidence, publishedAtUtc, contentHash }) {
  return [
    'npm run social:agent -- record-published',
    `--post ${postId}`,
    `--postUrl "${escapeCommandValue(postUrl)}"`,
    `--evidence "${escapeCommandValue(evidence)}"`,
    `--publishedAtUtc "${escapeCommandValue(publishedAtUtc)}"`,
    `--contentHash ${escapeCommandValue(contentHash)}`
  ].join(' ');
}

function canonicalPostUrlPattern(handle) {
  return new RegExp(`^https://x\\.com/${escapeRegExp(handle)}/status/\\d{8,}$`, 'i');
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

function normalizeMessage(value) {
  return String(value ?? '').replace(/\r/g, '').trim();
}

function hasUnsafePositiveClaims(text) {
  const cleaned = cleanLine(text).replace(
    /\b(no|not|without|do not|must not|does not|block(?:s)?|before separate Executive Chairman approval)[^.;\n]*(?:price guarantee|redemption promise|market-support|guaranteed buyers|fake engagement|bots|raids|investment return|payment instruction|asset movement|token grant|compensation|price floor)[^.;\n]*/gi,
    ''
  );
  return /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|investment return|private key|seed phrase|coordinated buy|100x|moon)\b/i.test(
    cleaned
  );
}

function escapeCommandValue(value) {
  return cleanLine(value).replaceAll('"', '\\"');
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
