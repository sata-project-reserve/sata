const FIELD_LABELS = {
  packetId: 'Outreach packet ID',
  prospectId: 'Prospect ID',
  contactChannel: 'Contact channel',
  contactEvidenceUrl: 'Contact evidence URL or reference',
  approvedMessageSha256: 'Approved message SHA-256',
  exactMessageSent: 'Exact message sent',
  sentAtUtc: 'Sent at UTC'
};

const REQUIRED_FIELDS = [
  'packetId',
  'prospectId',
  'contactChannel',
  'contactEvidenceUrl',
  'approvedMessageSha256',
  'exactMessageSent',
  'sentAtUtc'
];

export function parseOutreachContactEvidenceIssueBody(body) {
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

export function buildOutreachContactEvidenceDraft({ issue, packetQueue, pipeline }) {
  if (!packetQueue) throw new Error('Missing outreach packet queue.');
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const intake = parseOutreachContactEvidenceIssueBody(issue.body ?? '');
  const issueUrl = issue.url ?? issue.html_url ?? issue.web_url ?? '';
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !intake[field]);
  const packet = (packetQueue.packets ?? []).find((item) => item.id === intake.packetId) ?? null;
  const prospect = (pipeline.prospects ?? []).find((item) => item.id === intake.prospectId) ?? null;
  const findings = [];

  if (missingRequiredFields.length > 0) {
    findings.push(`Missing required fields: ${missingRequiredFields.join(', ')}`);
  }
  if (!packet) {
    findings.push(`Outreach packet not found: ${intake.packetId || '<missing>'}`);
  }
  if (!prospect) {
    findings.push(`Prospect not found: ${intake.prospectId || '<missing>'}`);
  }
  if (packet && prospect && packet.prospectId !== prospect.id) {
    findings.push(`Packet prospect mismatch: ${packet.prospectId} does not match ${prospect.id}`);
  }
  if (packet && packet.status !== 'ready-for-manual-send') {
    findings.push(`Packet is not ready for manual send: ${packet.status}`);
  }
  if (prospect && prospect.stage !== 'outreach-approved') {
    findings.push(`Prospect is not outreach-approved: ${prospect.stage}`);
  }
  if (packet && intake.exactMessageSent && normalizeMessage(packet.message) !== normalizeMessage(intake.exactMessageSent)) {
    findings.push('Exact message sent does not match the approved outreach packet.');
  }
  if (intake.approvedMessageSha256 && !/^[a-f0-9]{64}$/.test(intake.approvedMessageSha256)) {
    findings.push('Approved message SHA-256 must be a 64-character lowercase hex digest.');
  }
  if (packet && intake.approvedMessageSha256 && intake.approvedMessageSha256 !== packet.messageSha256) {
    findings.push('Approved message SHA-256 does not match the approved outreach packet.');
  }
  if (
    /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|private key|seed phrase)\b/i.test(
      intake.exactMessageSent
    )
  ) {
    findings.push('Exact message contains prohibited or secret-requesting language.');
  }
  if (intake.sentAtUtc && Number.isNaN(new Date(intake.sentAtUtc).getTime())) {
    findings.push('Sent at UTC must be a valid ISO timestamp.');
  }

  const command =
    findings.length === 0
      ? buildMarkSentCommand({
          packetId: packet.id,
          evidence: intake.contactEvidenceUrl || issueUrl,
          channel: intake.contactChannel,
          sentAtUtc: intake.sentAtUtc,
          messageHash: packet.messageSha256
        })
      : null;

  return {
    project: packetQueue.project ?? pipeline.project,
    mode: 'outreach-contact-evidence-intake',
    intake,
    issueUrl,
    missingRequiredFields,
    matchedPacket: packet
      ? {
          id: packet.id,
          prospectId: packet.prospectId,
          status: packet.status,
          offerId: packet.offerId
        }
      : null,
    matchedProspect: prospect
      ? {
          id: prospect.id,
          stage: prospect.stage,
          recommendedOfferId: prospect.recommendedOfferId
        }
      : null,
    messageMatchesApprovedPacket:
      Boolean(packet && intake.exactMessageSent) &&
      normalizeMessage(packet.message) === normalizeMessage(intake.exactMessageSent),
    hashMatchesApprovedPacket:
      Boolean(packet && intake.approvedMessageSha256) &&
      intake.approvedMessageSha256 === packet.messageSha256,
    readyToRecord: findings.length === 0,
    operatorCommand: command,
    findings,
    nextRequiredAction:
      findings.length === 0
        ? 'Authorized human may run the operator command to mark the packet sent and move the prospect to contacted.'
        : 'Fix the contact evidence issue before recording outreach as sent.',
    boundary:
      'This intake prepares a local evidence-recording command only. It does not send outreach, approve invoices, send payment instructions, grant tokens, publish posts, or move assets.'
  };
}

function buildMarkSentCommand({ packetId, evidence, channel, sentAtUtc, messageHash }) {
  const parts = [
    'node scripts/service-outreach-packet-agent.mjs mark-sent',
    `--packet ${packetId}`,
    `--evidence "${escapeCommandValue(evidence)}"`,
    `--channel "${escapeCommandValue(channel)}"`
  ];
  parts.push(`--sentAtUtc "${escapeCommandValue(sentAtUtc)}"`);
  if (cleanValue(messageHash)) {
    parts.push(`--messageHash ${escapeCommandValue(messageHash)}`);
  }
  return parts.join(' ');
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

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeMessage(value) {
  return String(value ?? '').replace(/\r/g, '').trim();
}

function escapeCommandValue(value) {
  return cleanLine(value).replaceAll('"', '\\"');
}
