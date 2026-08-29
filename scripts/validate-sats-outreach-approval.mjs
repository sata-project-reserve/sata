import {
  buildOutreachApprovalPacket,
  renderOutreachApprovalPacket
} from './lib/prospect-outreach-approval.mjs';

const pipeline = {
  project: 'SATA Reserve Token',
  activeCycleId: 'revenue-cycle-001',
  primaryOfferId: 'transparency-audit',
  dailyCadence: {
    outreachLimit: 2
  },
  prospects: [
    prospect({ id: 'reviewed-team', stage: 'chairman-review', approved: true }),
    prospect({ id: 'second-reviewed-team', stage: 'chairman-review', approved: true }),
    prospect({ id: 'identified-team', stage: 'identified', approved: false }),
    prospect({ id: 'outreach-team', stage: 'outreach-approved', approved: true })
  ]
};
const findings = [];

const packet = buildOutreachApprovalPacket({
  pipeline,
  prospectIds: 'reviewed-team',
  generatedAtUtc: '2026-08-29T09:30:00.000Z'
});
const rendered = renderOutreachApprovalPacket({
  pipeline,
  prospectIds: 'reviewed-team',
  generatedAtUtc: '2026-08-29T09:30:00.000Z'
});

if (packet.mode !== 'chairman-outreach-approval-packet') {
  findings.push('packet mode must be chairman-outreach-approval-packet');
}
if (packet.approvalItem.status !== 'ready-for-chairman-review') {
  findings.push('approval item must be ready-for-chairman-review');
}
if (packet.approvalItem.category !== 'revenue-action') {
  findings.push('approval item must be a revenue-action');
}
if (!/contact-only outreach/i.test(packet.approvalItem.summary)) {
  findings.push('approval item must be contact-only');
}
if (!/does not approve invoices/i.test(packet.boundary)) {
  findings.push('packet boundary must reject invoice approval');
}
if (!/separate chairman-approved exact-sats invoice/i.test(packet.approvalItem.riskReview.join('\n'))) {
  findings.push('approval item must require separate exact-sats invoice approval');
}

for (const required of [
  /SATA Outreach Approval Packet/i,
  /reviewed-team/i,
  /Proposed stage: outreach-approved/i,
  /Contact scope/i,
  /does not approve invoices/i
]) {
  if (!required.test(rendered)) findings.push(`rendered packet missing ${required}`);
}

for (const testCase of [
  {
    name: 'identified prospect',
    prospectIds: 'identified-team',
    expected: /requires chairman-review stage/
  },
  {
    name: 'already outreach prospect',
    prospectIds: 'outreach-team',
    expected: /requires chairman-review stage/
  },
  {
    name: 'unknown prospect',
    prospectIds: 'missing-team',
    expected: /Prospect not found/
  },
  {
    name: 'daily limit',
    prospectIds: 'reviewed-team,second-reviewed-team,missing-team',
    expected: /Prospect not found/
  }
]) {
  assertRejects(testCase.name, testCase.expected, () =>
    buildOutreachApprovalPacket({ pipeline, prospectIds: testCase.prospectIds })
  );
}

const tooManyPipeline = {
  ...pipeline,
  dailyCadence: { outreachLimit: 1 }
};
assertRejects('outreach limit', /exceeds daily outreach limit/, () =>
  buildOutreachApprovalPacket({
    pipeline: tooManyPipeline,
    prospectIds: 'reviewed-team,second-reviewed-team'
  })
);

if (findings.length > 0) {
  console.error('Sats outreach approval check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats outreach approval check passed: contact approval packets require chairman-reviewed prospects and preserve invoice gates.');

function prospect({ id, stage, approved }) {
  return {
    id,
    stage,
    source: 'test',
    publicProfileUrl: `https://x.com/${id}`,
    projectUrl: `https://${id}.invalid`,
    observedClaim: 'Public transparency claims need an evidence review.',
    recommendedOfferId: 'transparency-audit',
    chairmanApprovedBeforeOutreach: approved,
    evidence: [`https://${id}.invalid`]
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
