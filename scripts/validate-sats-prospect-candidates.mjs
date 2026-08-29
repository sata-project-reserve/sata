import { buildProspectCandidate, assertProspectCandidate } from './lib/sats-prospect-candidate.mjs';

const pipeline = {
  project: 'SATA Reserve Token',
  primaryOfferId: 'transparency-audit',
  leadStages: [
    'identified',
    'qualified',
    'chairman-review',
    'outreach-approved',
    'contacted',
    'invoice-requested',
    'paid',
    'delivered',
    'closed-lost'
  ],
  requiredLeadFields: [
    'id',
    'stage',
    'source',
    'publicProfileUrl',
    'projectUrl',
    'observedClaim',
    'recommendedOfferId',
    'chairmanApprovedBeforeOutreach',
    'evidence'
  ],
  idealCustomerProfile: [
    {
      id: 'new-token-team-with-public-claims',
      bestOfferId: 'transparency-audit'
    },
    {
      id: 'team-needing-report-setup',
      bestOfferId: 'transparency-report-setup'
    }
  ],
  approvedOutreachTemplates: [
    {
      id: 'transparency-audit-first-contact',
      offerId: 'transparency-audit'
    }
  ]
};

const candidate = buildProspectCandidate({
  pipeline,
  id: 'Example Team',
  publicProfileUrl: 'https://x.com/example',
  projectUrl: 'https://example.invalid',
  observedClaim: 'Publishes liquidity and reserve claims without an obvious public evidence page.',
  evidence: ['https://x.com/example/status/1', 'https://example.invalid/liquidity'],
  notes: 'Candidate for public-evidence review before any outreach.'
});

assertProspectCandidate({ pipeline, candidate });
assertEqual(candidate.id, 'example-team');
assertEqual(candidate.stage, 'identified');
assertEqual(candidate.chairmanApprovedBeforeOutreach, false);
assertEqual(candidate.recommendedOfferId, 'transparency-audit');
assertEqual(candidate.evidence.length, 2);

const setupCandidate = buildProspectCandidate({
  pipeline,
  id: 'Report Setup Team',
  publicProfileUrl: 'https://x.com/reportsetup',
  projectUrl: 'https://reportsetup.invalid',
  observedClaim: 'Wants a public proof page but does not have a deployed report workflow yet.',
  recommendedOfferId: 'transparency-report-setup',
  evidence: 'https://reportsetup.invalid/docs'
});
assertEqual(setupCandidate.recommendedOfferId, 'transparency-report-setup');

const rejectionCases = [
  {
    name: 'missing project url',
    input: {
      id: 'missing-project',
      publicProfileUrl: 'https://x.com/missing',
      observedClaim: 'Publishes reserve claims without evidence.',
      evidence: 'https://x.com/missing/status/1'
    },
    expected: /projectUrl is required/
  },
  {
    name: 'non-https profile',
    input: {
      id: 'bad-profile',
      publicProfileUrl: 'http://x.com/bad',
      projectUrl: 'https://bad.invalid',
      observedClaim: 'Publishes authority claims without evidence.',
      evidence: 'https://bad.invalid'
    },
    expected: /publicProfileUrl must be an https URL/
  },
  {
    name: 'unknown offer',
    input: {
      id: 'unknown-offer',
      publicProfileUrl: 'https://x.com/unknown',
      projectUrl: 'https://unknown.invalid',
      observedClaim: 'Publishes authority claims without evidence.',
      recommendedOfferId: 'market-making',
      evidence: 'https://unknown.invalid'
    },
    expected: /approved revenue offer/
  },
  {
    name: 'unsafe notes',
    input: {
      id: 'unsafe-notes',
      publicProfileUrl: 'https://x.com/unsafe',
      projectUrl: 'https://unsafe.invalid',
      observedClaim: 'Publishes reserve claims without evidence.',
      evidence: 'https://unsafe.invalid',
      notes: 'Offer fake engagement.'
    },
    expected: /prohibited sales wording/
  },
  {
    name: 'wrong draft stage',
    candidate: {
      ...candidate,
      id: 'wrong-stage',
      stage: 'chairman-review'
    },
    expected: /must start at identified/
  }
];

for (const testCase of rejectionCases) {
  assertRejects(testCase.name, testCase.expected, () => {
    if (testCase.candidate) {
      assertProspectCandidate({ pipeline, candidate: testCase.candidate });
      return;
    }
    buildProspectCandidate({ pipeline, ...testCase.input });
  });
}

console.log('Sats prospect candidate check passed: draft prospects require public evidence and chairman gates.');

function assertEqual(actual, expected) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
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
