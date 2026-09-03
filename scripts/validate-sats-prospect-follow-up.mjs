import {
  buildProspectFollowUpPlan,
  recordProspectFollowUp,
  renderProspectFollowUp,
  validateProspectFollowUps
} from './lib/prospect-follow-up.mjs';

const pipeline = {
  project: 'SATA Reserve Token',
  dailyCadence: {
    followUpAfterHours: 48
  },
  prospects: [
    contactedProspect({
      id: 'due-team',
      contactedAtUtc: '2026-09-01T10:00:00.000Z'
    }),
    contactedProspect({
      id: 'fresh-team',
      contactedAtUtc: '2026-09-03T10:00:00.000Z'
    }),
    {
      id: 'identified-team',
      stage: 'identified',
      source: 'test',
      publicProfileUrl: 'https://example.com/identified-team',
      projectUrl: 'https://example.com/identified-team',
      observedClaim: 'Public transparency claims need review.',
      recommendedOfferId: 'transparency-audit',
      chairmanApprovedBeforeOutreach: false,
      evidence: ['https://example.com/identified-team']
    }
  ]
};
const findings = [];

const plan = buildProspectFollowUpPlan({
  pipeline,
  generatedAtUtc: '2026-09-03T11:00:00.000Z'
});
if (plan.mode !== 'prospect-follow-up-planner') {
  findings.push('plan mode must be prospect-follow-up-planner');
}
if (plan.due.length !== 1 || plan.due[0].id !== 'due-team') {
  findings.push('plan must include only contacted prospects past the follow-up window');
}
if (!/does not approve invoices/i.test(plan.boundary ?? '')) {
  findings.push('plan boundary must preserve invoice approval gate');
}

const message = renderProspectFollowUp({
  pipeline,
  prospectId: 'due-team',
  generatedAtUtc: '2026-09-03T11:00:00.000Z'
});
for (const required of [
  'Quick follow-up',
  'starter audit remains $50',
  'Executive Chairman approves'
]) {
  if (!message.includes(required)) findings.push(`follow-up message missing ${required}`);
}
for (const prohibited of [/pay now/i, /send .*to .*wallet/i, /\bpump\b/i, /guaranteed buyers/i]) {
  if (prohibited.test(message))
    findings.push(`follow-up message contains prohibited wording ${prohibited}`);
}

const followedUp = recordProspectFollowUp({
  pipeline,
  prospectId: 'due-team',
  followUpEvidence: 'https://x.com/example/status/follow-up',
  followUpChannel: 'manual-dm',
  followedUpAtUtc: '2026-09-03T11:00:00.000Z'
});
const updated = followedUp.prospects.find((prospect) => prospect.id === 'due-team');
if (updated?.stage !== 'contacted') findings.push('recording follow-up must not advance stage');
if (updated?.followUps?.[0]?.evidence !== 'https://x.com/example/status/follow-up') {
  findings.push('recording follow-up must preserve evidence');
}
if (!/Invoice still requires explicit customer request/i.test(updated?.stageNotes ?? '')) {
  findings.push('recording follow-up must preserve invoice request gate');
}
validateProspectFollowUps({ pipeline: followedUp });

assertRejects('render not due', /no follow-up is currently due/i, () =>
  renderProspectFollowUp({
    pipeline,
    prospectId: 'fresh-team',
    generatedAtUtc: '2026-09-03T11:00:00.000Z'
  })
);
assertRejects('record wrong stage', /requires contacted stage/i, () =>
  recordProspectFollowUp({
    pipeline,
    prospectId: 'identified-team',
    followUpEvidence: 'https://x.com/example/status/follow-up',
    followedUpAtUtc: '2026-09-03T11:00:00.000Z'
  })
);
assertRejects('record missing evidence', /Follow-up evidence is required/i, () =>
  recordProspectFollowUp({
    pipeline,
    prospectId: 'due-team',
    followUpEvidence: 'short',
    followedUpAtUtc: '2026-09-03T11:00:00.000Z'
  })
);
assertRejects('record too early', /not due yet/i, () =>
  recordProspectFollowUp({
    pipeline,
    prospectId: 'fresh-team',
    followUpEvidence: 'https://x.com/example/status/follow-up',
    followedUpAtUtc: '2026-09-03T11:00:00.000Z'
  })
);

if (findings.length > 0) {
  console.error('Sats prospect follow-up check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Sats prospect follow-up check passed: follow-ups are time-gated, evidence-backed, and non-custodial.'
);

function contactedProspect({ id, contactedAtUtc }) {
  return {
    id,
    stage: 'contacted',
    source: 'test',
    publicProfileUrl: `https://example.com/${id}`,
    projectUrl: `https://example.com/${id}`,
    observedClaim: 'Public transparency claims need review.',
    recommendedOfferId: 'transparency-audit',
    chairmanApprovedBeforeOutreach: true,
    evidence: [`https://example.com/${id}`],
    outreachApprovalId: 'outreach-approval-test',
    contact: {
      channel: 'manual-dm',
      evidence: `https://x.com/example/status/contact-${id}`,
      contactedAtUtc
    }
  };
}

function assertRejects(name, expected, fn) {
  try {
    fn();
  } catch (error) {
    if (!expected.test(error.message)) {
      throw new Error(`${name}: expected ${expected}, received ${error.message}`);
    }
    return;
  }
  throw new Error(`${name}: expected rejection.`);
}
