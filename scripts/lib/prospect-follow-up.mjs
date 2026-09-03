const CONTACTED_STAGE = 'contacted';

export function buildProspectFollowUpPlan({ pipeline, generatedAtUtc = new Date().toISOString() }) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const generatedAt = parseDate(generatedAtUtc, 'generatedAtUtc');
  const dueAfterHours = Number(pipeline.dailyCadence?.followUpAfterHours ?? 48);
  if (!Number.isSafeInteger(dueAfterHours) || dueAfterHours < 24) {
    throw new Error('pipeline.dailyCadence.followUpAfterHours must be an integer >= 24.');
  }

  const contacted = (pipeline.prospects ?? []).filter(
    (prospect) => prospect.stage === CONTACTED_STAGE
  );
  const due = contacted.filter((prospect) =>
    isFollowUpDue({ prospect, generatedAt, dueAfterHours })
  );

  return {
    project: pipeline.project,
    mode: 'prospect-follow-up-planner',
    generatedAtUtc,
    dueAfterHours,
    contacted: contacted.map(summaryForPlan),
    due: due.map((prospect) => ({
      ...summaryForPlan(prospect),
      dueAtUtc: dueAtUtc({ prospect, dueAfterHours })
    })),
    blocked: due.length === 0,
    nextAction:
      due.length > 0
        ? `Render a compliant follow-up for ${due[0].id}; send manually only as written and record evidence.`
        : 'Wait until a contacted prospect reaches the configured follow-up window, or record an invoice request if the customer asks for one.',
    boundary:
      'This plan is manual, factual, and evidence-gated. It does not approve invoices, send payment instructions, request payment, move assets, grant tokens, or make market-support claims.'
  };
}

export function renderProspectFollowUp({
  pipeline,
  prospectId,
  generatedAtUtc = new Date().toISOString()
}) {
  const plan = buildProspectFollowUpPlan({ pipeline, generatedAtUtc });
  const due = plan.due.find((prospect) => prospect.id === cleanLine(prospectId));
  if (!due) {
    throw new Error(`${cleanLine(prospectId)}: no follow-up is currently due.`);
  }
  return [
    `Hi ${due.id},`,
    '',
    'Quick follow-up on the SATA transparency audit note.',
    'If this is useful, send the public token or contract address plus the authority, liquidity, reserve, or disclosure claims you want checked.',
    'The starter audit remains $50, but no invoice is issued and no payment details are provided unless you explicitly ask to proceed and the SATA Executive Chairman approves the exact-sats invoice.',
    '',
    'Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit',
    'Intake form: https://github.com/sata-project-reserve/sata/issues/new?template=transparency-audit-intake.yml',
    '',
    'No price guarantee, no redemption promise, no investor targeting, and no market-support commitment.'
  ].join('\n');
}

export function recordProspectFollowUp({
  pipeline,
  prospectId,
  followUpEvidence,
  followUpChannel = 'manual-dm-or-email',
  followedUpAtUtc = new Date().toISOString()
}) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const evidence = requireEvidence(followUpEvidence, 'Follow-up evidence is required.');
  const id = cleanLine(prospectId);
  if (!id) throw new Error('Prospect id is required.');
  const followedUpAt = parseDate(followedUpAtUtc, 'followedUpAtUtc');
  const dueAfterHours = Number(pipeline.dailyCadence?.followUpAfterHours ?? 48);

  let found = false;
  const prospects = (pipeline.prospects ?? []).map((prospect) => {
    if (prospect.id !== id) return prospect;
    found = true;
    if (prospect.stage !== CONTACTED_STAGE) {
      throw new Error(`${prospect.id}: follow-up recording requires contacted stage.`);
    }
    if (!prospect.contact?.evidence || !prospect.contact?.contactedAtUtc) {
      throw new Error(`${prospect.id}: follow-up recording requires prior contact evidence.`);
    }
    if (!isFollowUpDue({ prospect, generatedAt: followedUpAt, dueAfterHours })) {
      throw new Error(`${prospect.id}: follow-up is not due yet.`);
    }
    return {
      ...prospect,
      followUps: [
        ...(prospect.followUps ?? []),
        {
          channel: cleanLine(followUpChannel),
          evidence,
          followedUpAtUtc
        }
      ],
      stageUpdatedAtUtc: followedUpAtUtc,
      stageNotes:
        'Follow-up evidence recorded. Invoice still requires explicit customer request evidence and Executive Chairman approval.'
    };
  });
  if (!found) throw new Error(`Prospect not found: ${id}`);
  return {
    ...pipeline,
    updatedAtUtc: followedUpAtUtc,
    prospects
  };
}

export function validateProspectFollowUps({ pipeline }) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const findings = [];
  for (const prospect of pipeline.prospects ?? []) {
    for (const [index, followUp] of (prospect.followUps ?? []).entries()) {
      const label = `${prospect.id}.followUps[${index}]`;
      if (prospect.stage !== CONTACTED_STAGE && prospect.stage !== 'invoice-requested') {
        findings.push(`${label}: follow-ups require contacted or invoice-requested stage`);
      }
      for (const field of ['channel', 'evidence', 'followedUpAtUtc']) {
        if (!cleanLine(followUp[field])) findings.push(`${label}: ${field} is required`);
      }
      if (
        /pay now|send .*to .*wallet|\bpump\b|guaranteed buyers|fake engagement|\bbots\b|\braids\b/i.test(
          followUp.evidence ?? ''
        )
      ) {
        findings.push(`${label}: evidence contains prohibited or misleading follow-up wording`);
      }
    }
  }
  if (findings.length > 0) {
    throw new Error(`Prospect follow-up records are invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function isFollowUpDue({ prospect, generatedAt, dueAfterHours }) {
  const contactedAt = parseDate(
    prospect.contact?.contactedAtUtc,
    `${prospect.id}.contact.contactedAtUtc`
  );
  const lastFollowUpAt = [...(prospect.followUps ?? [])]
    .map((followUp) => followUp.followedUpAtUtc)
    .filter(Boolean)
    .sort()
    .at(-1);
  const basis = lastFollowUpAt
    ? parseDate(lastFollowUpAt, `${prospect.id}.followUps.followedUpAtUtc`)
    : contactedAt;
  const dueAt = new Date(basis.getTime() + dueAfterHours * 60 * 60 * 1000);
  return generatedAt >= dueAt;
}

function dueAtUtc({ prospect, dueAfterHours }) {
  const contactedAt = parseDate(
    prospect.contact?.contactedAtUtc,
    `${prospect.id}.contact.contactedAtUtc`
  );
  const lastFollowUpAt = [...(prospect.followUps ?? [])]
    .map((followUp) => followUp.followedUpAtUtc)
    .filter(Boolean)
    .sort()
    .at(-1);
  const basis = lastFollowUpAt
    ? parseDate(lastFollowUpAt, `${prospect.id}.followUps.followedUpAtUtc`)
    : contactedAt;
  return new Date(basis.getTime() + dueAfterHours * 60 * 60 * 1000).toISOString();
}

function summaryForPlan(prospect) {
  return {
    id: prospect.id,
    stage: prospect.stage,
    recommendedOfferId: prospect.recommendedOfferId,
    projectUrl: prospect.projectUrl,
    contactedAtUtc: prospect.contact?.contactedAtUtc ?? null,
    followUpCount: (prospect.followUps ?? []).length
  };
}

function parseDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime()))
    throw new Error(`${label} must be a valid timestamp.`);
  return date;
}

function requireEvidence(value, message) {
  const evidence = cleanLine(value);
  if (evidence.length < 8) throw new Error(message);
  return evidence;
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
