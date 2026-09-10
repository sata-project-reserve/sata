import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildRevenueCycleStatus,
  validateRevenueCycleStatus
} from './lib/revenue-cycle-status.mjs';

const reserveAddress = 'bc1q7dgqqyfh7gxn2kze874d07w4qcj43v4zptv6kk';

const baseInputs = {
  report: {
    generatedAtUtc: '2026-08-29T01:00:00Z',
    bitcoinReserve: {
      address: reserveAddress,
      confirmedReserveSats: '500000'
    }
  },
  revenuePlan: {
    project: 'SATA Reserve Token',
    objective:
      'Generate legitimate operating revenue from existing SATA transparency infrastructure and allocate approved proceeds toward the 1,000,000,000 sats reserve target.',
    nextCycle: {
      id: 'revenue-cycle-001'
    }
  },
  ledger: {
    target: {
      targetSats: '1000000000',
      currentReserveSats: '500000'
    },
    receipts: [],
    allocations: []
  },
  invoiceQueue: {
    paymentPolicy: {
      reserveAddress
    },
    invoices: []
  },
  prospectPipeline: {
    target: {
      reserveTargetSats: '1000000000'
    },
    prospects: [],
    nextOperatingAction:
      'Identify ten crypto teams with public but weakly evidenced authority, liquidity, reserve, or disclosure claims; record only evidence-backed prospects for chairman review.'
  },
  outreachPacketQueue: {
    packets: []
  },
  inboundLeadQueue: {
    leads: []
  },
  paidPromotionLedger: {
    campaigns: []
  },
  referralPartnerPolicy: {
    status: 'approved-by-chairman'
  },
  referralPartnerHandoffQueue: {
    handoffs: []
  },
  approvalQueue: {
    items: []
  },
  socialQueue: {
    mode: 'approved-only-automation',
    posts: [
      {
        id: 'transparency-service-offer',
        status: 'approved',
        text: 'SATA offers transparency audits.'
      }
    ]
  }
};

const status = buildRevenueCycleStatus({ ...baseInputs, env: {} });
validateRevenueCycleStatus(status);
assertEqual(status.currentReserve.remainingSats, '999500000');
assertEqual(status.funnel.prospects, 0);
assertEqual(status.funnel.paidPromotionCampaigns, 0);
assertEqual(status.funnel.paidPromotionsAwaitingVerification, 0);
assertEqual(status.social.livePostingEnabled, false);
assertEqual(status.actionQueue[0]?.type, 'prospect-discovery');
assertIncludes(status.blockers, 'No evidence-backed prospects are recorded.');
assertIncludes(
  status.nextAction,
  'Identify ten crypto teams with public but weakly evidenced authority, liquidity, reserve, or disclosure claims'
);

const readyInvoiceStatus = buildRevenueCycleStatus({
  ...baseInputs,
  invoiceQueue: {
    ...baseInputs.invoiceQueue,
    invoices: [
      {
        id: 'invoice-ready-1',
        status: 'approved-by-chairman'
      }
    ]
  },
  prospectPipeline: {
    ...baseInputs.prospectPipeline,
    prospects: [
      {
        id: 'prospect-1',
        stage: 'outreach-approved'
      }
    ]
  },
  env: {
    SATA_X_AGENT_ENABLE_POSTING: 'true',
    X_ACCESS_TOKEN: 'test-token'
  }
});
validateRevenueCycleStatus(readyInvoiceStatus);
assertIncludes(
  readyInvoiceStatus.nextAction,
  'Render approved customer payment packet for invoice-ready-1'
);
assertEqual(readyInvoiceStatus.social.livePostingEnabled, true);

const manualSocialPublishStatus = buildRevenueCycleStatus({
  ...baseInputs,
  env: {},
  socialQueue: {
    mode: 'approved-only-automation',
    posts: [
      {
        id: 'approved-social-post',
        status: 'approved',
        text: 'SATA publishes factual reserve and transparency updates. Not a price target.'
      }
    ]
  }
});
validateRevenueCycleStatus(manualSocialPublishStatus);
const manualSocialPublishAction = manualSocialPublishStatus.actionQueue.find(
  (item) => item.type === 'manual-social-publish'
);
assertEqual(manualSocialPublishAction?.type, 'manual-social-publish');
assertIncludes(manualSocialPublishAction?.command, '--contentHash ');
assertIncludes(manualSocialPublishAction?.command, '--publishedAtUtc "<published-at-utc>"');

const receiptStatus = buildRevenueCycleStatus({
  ...baseInputs,
  ledger: {
    ...baseInputs.ledger,
    receipts: [
      {
        id: 'receipt-1',
        status: 'confirmed'
      }
    ],
    allocations: []
  },
  env: {}
});
validateRevenueCycleStatus(receiptStatus);
assertIncludes(receiptStatus.nextAction, 'Render receipt allocation proposal for receipt-1');
assertEqual(receiptStatus.funnel.receiptsAwaitingAllocation, 1);

const inboundInvoiceStatus = buildRevenueCycleStatus({
  ...baseInputs,
  inboundLeadQueue: {
    leads: [
      {
        id: 'hot-inbound-lead',
        status: 'invoice-requested-needs-chairman-review',
        customerAskedForInvoice: true
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(inboundInvoiceStatus);
assertEqual(inboundInvoiceStatus.funnel.inboundInvoiceRequestsNeedingChairmanReview, 1);
assertEqual(inboundInvoiceStatus.actionQueue[0]?.type, 'inbound-invoice-request-packet');
assertIncludes(
  inboundInvoiceStatus.nextAction,
  'Render chairman review packet for inbound invoice request hot-inbound-lead'
);

const outboundInvoiceStatus = buildRevenueCycleStatus({
  ...baseInputs,
  prospectPipeline: {
    ...baseInputs.prospectPipeline,
    prospects: [
      {
        id: 'invoice-requested-prospect',
        stage: 'invoice-requested'
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(outboundInvoiceStatus);
const outboundInvoiceAction = outboundInvoiceStatus.actionQueue.find(
  (item) => item.type === 'invoice-quote-inputs'
);
assertIncludes(
  outboundInvoiceAction?.command,
  'sats-invoice-request-agent.mjs render --prospects invoice-requested-prospect'
);

const inboundIntakeStatus = buildRevenueCycleStatus({
  ...baseInputs,
  inboundLeadQueue: {
    leads: [
      {
        id: 'warm-inbound-lead',
        status: 'needs-intake',
        customerAskedForInvoice: false
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(inboundIntakeStatus);
assertEqual(inboundIntakeStatus.funnel.openInboundLeads, 1);
assertEqual(inboundIntakeStatus.funnel.inboundLeadsNeedingIntake, 1);
assertEqual(inboundIntakeStatus.actionQueue[0]?.type, 'inbound-intake-reply');
assertIncludes(
  inboundIntakeStatus.nextAction,
  'Send intake-fields reply for inbound lead warm-inbound-lead'
);

const readyOutreachPacketStatus = buildRevenueCycleStatus({
  ...baseInputs,
  prospectPipeline: {
    ...baseInputs.prospectPipeline,
    prospects: [
      {
        id: 'prospect-1',
        stage: 'outreach-approved'
      }
    ]
  },
  outreachPacketQueue: {
    packets: [
      {
        id: 'outreach-packet-1',
        status: 'ready-for-manual-send'
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(readyOutreachPacketStatus);
assertEqual(readyOutreachPacketStatus.funnel.readyOutreachPackets, 1);
assertEqual(readyOutreachPacketStatus.actionQueue[0]?.type, 'manual-outreach-send');
assertIncludes(readyOutreachPacketStatus.actionQueue[0]?.command, '--sentAtUtc "<sent-at-utc>"');
assertIncludes(
  readyOutreachPacketStatus.actionQueue[0]?.command,
  '--messageHash "<approved-message-sha256>"'
);
assertIncludes(
  readyOutreachPacketStatus.nextAction,
  'Send ready manual outreach packet outreach-packet-1'
);

const prioritizedOutreachStatus = buildRevenueCycleStatus({
  ...baseInputs,
  revenuePlan: {
    ...baseInputs.revenuePlan,
    revenueStreams: [
      {
        id: 'transparency-audit',
        priceUsd: '50'
      }
    ]
  },
  prospectPipeline: {
    ...baseInputs.prospectPipeline,
    prospects: [
      {
        id: 'low-fit',
        stage: 'outreach-approved',
        observedClaim: 'Meme coin landing page.',
        projectUrl: 'https://example.com/low'
      },
      {
        id: 'high-fit',
        stage: 'outreach-approved',
        observedClaim:
          'Whitepaper claims BTC reserve, multisig custody, mint authority controls, and liquidity lock.',
        projectUrl: 'https://example.com/high',
        evidence: ['https://example.com/high', 'https://example.com/high/whitepaper'],
        chairmanApprovedBeforeOutreach: true
      }
    ]
  },
  outreachPacketQueue: {
    packets: [
      {
        id: 'outreach-low-fit',
        prospectId: 'low-fit',
        offerId: 'transparency-audit',
        status: 'ready-for-manual-send'
      },
      {
        id: 'outreach-high-fit',
        prospectId: 'high-fit',
        offerId: 'transparency-audit',
        status: 'ready-for-manual-send'
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(prioritizedOutreachStatus);
assertEqual(prioritizedOutreachStatus.actionQueue[0]?.id, 'send-outreach-high-fit');
assertEqual(prioritizedOutreachStatus.actionQueue[0]?.outreachPriority?.tier, 'hot');
assertEqual(prioritizedOutreachStatus.actionQueue[1]?.id, 'send-outreach-low-fit');

const paidPromotionStatus = buildRevenueCycleStatus({
  ...baseInputs,
  paidPromotionLedger: {
    campaigns: [
      {
        id: 'campaign-1',
        status: 'post-reported-unverified'
      }
    ]
  },
  prospectPipeline: {
    ...baseInputs.prospectPipeline,
    prospects: [
      {
        id: 'prospect-1',
        stage: 'outreach-approved'
      }
    ]
  },
  outreachPacketQueue: {
    packets: [
      {
        id: 'outreach-packet-1',
        status: 'ready-for-manual-send'
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(paidPromotionStatus);
assertEqual(paidPromotionStatus.funnel.paidPromotionCampaigns, 1);
assertEqual(paidPromotionStatus.funnel.paidPromotionsAwaitingVerification, 1);
assertEqual(paidPromotionStatus.actionQueue[0]?.type, 'paid-promotion-verification');
assertIncludes(paidPromotionStatus.nextAction, 'Verify paid promotion campaign campaign-1');

const liveVerifiedPaidPromotionStatus = buildRevenueCycleStatus({
  ...baseInputs,
  paidPromotionLedger: {
    campaigns: [
      {
        id: 'campaign-1',
        status: 'live-verified'
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(liveVerifiedPaidPromotionStatus);
assertEqual(
  liveVerifiedPaidPromotionStatus.actionQueue[0]?.type,
  'paid-promotion-conversion-measurement'
);
assertIncludes(liveVerifiedPaidPromotionStatus.actionQueue[0]?.command, '--measuredAtUtc "<measured-at-utc>"');

const completedPaidPromotionStatus = buildRevenueCycleStatus({
  ...baseInputs,
  paidPromotionLedger: {
    campaigns: [
      {
        id: 'campaign-1',
        status: 'completed',
        promoter: {
          displayName: 'Diana Crypto',
          handle: '142C_'
        },
        reportedPostUrl: 'https://x.com/142C_/status/2086570576530010172',
        conversion: {
          confirmedReceiptsSats: '0'
        }
      }
    ]
  },
  prospectPipeline: {
    ...baseInputs.prospectPipeline,
    prospects: [
      {
        id: 'prospect-1',
        stage: 'outreach-approved'
      }
    ]
  },
  outreachPacketQueue: {
    packets: [
      {
        id: 'outreach-packet-1',
        status: 'ready-for-manual-send'
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(completedPaidPromotionStatus);
assertEqual(completedPaidPromotionStatus.actionQueue[0]?.type, 'post-receipt-referral-handoff');
assertEqual(completedPaidPromotionStatus.actionQueue[1]?.type, 'inbound-reply-triage-monitor');
assertIncludes(
  completedPaidPromotionStatus.actionQueue[1]?.command,
  'npm run ops:inbound-reply-triage-plan'
);
assertIncludes(
  completedPaidPromotionStatus.actionQueue[1]?.sources?.[0]?.triageCommand,
  'inbound-reply-triage-agent.mjs markdown'
);
assertIncludes(
  completedPaidPromotionStatus.nextAction,
  'Prepare and send Diana Crypto a no-upfront post-receipt referral role'
);
assertIncludes(
  completedPaidPromotionStatus.actionQueue[0]?.command,
  'referral-partner-handoff-agent.mjs write-packet --campaign campaign-1'
);
assertEqual(
  completedPaidPromotionStatus.actionQueue[0]?.artifact,
  'public/referral-partner-handoff-packet.md'
);

const preparedReferralPacketStatus = buildRevenueCycleStatus({
  ...baseInputs,
  paidPromotionLedger: completedPaidPromotionStatusInput().paidPromotionLedger,
  referralPartnerHandoffPacket: {
    mode: 'referral-partner-handoff-packet',
    sourceCampaignId: 'campaign-1',
    recordSentCommand:
      'node scripts/referral-partner-handoff-agent.mjs record-sent --campaign campaign-1 --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>" --messageHash 71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18'
  },
  prospectPipeline: completedPaidPromotionStatusInput().prospectPipeline,
  outreachPacketQueue: completedPaidPromotionStatusInput().outreachPacketQueue,
  env: {}
});
validateRevenueCycleStatus(preparedReferralPacketStatus);
assertEqual(preparedReferralPacketStatus.actionQueue[0]?.type, 'manual-referral-handoff-send');
assertEqual(preparedReferralPacketStatus.actionQueue[1]?.type, 'inbound-reply-triage-monitor');
assertIncludes(
  preparedReferralPacketStatus.nextAction,
  'Send prepared no-upfront post-receipt referral terms'
);
assertIncludes(
  preparedReferralPacketStatus.actionQueue[0]?.command,
  'record-sent --campaign campaign-1'
);
assertIncludes(preparedReferralPacketStatus.actionQueue[0]?.command, '--sentAtUtc "<sent-at-utc>"');
assertIncludes(
  preparedReferralPacketStatus.actionQueue[0]?.command,
  '--messageHash 71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18'
);

const sentReferralHandoffStatus = buildRevenueCycleStatus({
  ...baseInputs,
  paidPromotionLedger: completedPaidPromotionStatusInput().paidPromotionLedger,
  referralPartnerHandoffQueue: {
    handoffs: [
      {
        id: 'handoff-campaign-1',
        sourceCampaignId: 'campaign-1',
        status: 'sent-awaiting-response',
        partner: {
          id: 'diana-crypto'
        }
      }
    ]
  },
  prospectPipeline: completedPaidPromotionStatusInput().prospectPipeline,
  outreachPacketQueue: completedPaidPromotionStatusInput().outreachPacketQueue,
  env: {}
});
validateRevenueCycleStatus(sentReferralHandoffStatus);
assertEqual(sentReferralHandoffStatus.actionQueue[0]?.type, 'track-referral-handoff-response');
assertIncludes(
  sentReferralHandoffStatus.actionQueue[0]?.command,
  '--respondedAtUtc "<responded-at-utc>"'
);
assertIncludes(
  sentReferralHandoffStatus.nextAction,
  'Record partner response for referral handoff handoff-campaign-1'
);

const pendingApprovalStatus = buildRevenueCycleStatus({
  ...baseInputs,
  prospectPipeline: {
    ...baseInputs.prospectPipeline,
    prospects: [
      {
        id: 'prospect-1',
        stage: 'chairman-review'
      }
    ]
  },
  approvalQueue: {
    items: [
      {
        id: 'outreach-approval-1',
        status: 'ready-for-chairman-review',
        title: 'Approve factual outreach to prospect-1',
        evidence: [{ url: 'https://example.com' }]
      }
    ]
  },
  env: {}
});
validateRevenueCycleStatus(pendingApprovalStatus);
assertEqual(pendingApprovalStatus.actionQueue[0]?.type, 'chairman-approval-needed');
assertIncludes(
  pendingApprovalStatus.nextAction,
  'Chairman decision needed for outreach-approval-1'
);
if (
  pendingApprovalStatus.actionQueue.some((item) => item.id === 'draft-outreach-approval-prospect-1')
) {
  throw new Error('Pending outreach approvals must not produce duplicate draft actions.');
}

assertRejects('wrong reserve address', /Invoice reserve address/, () =>
  buildRevenueCycleStatus({
    ...baseInputs,
    invoiceQueue: {
      ...baseInputs.invoiceQueue,
      paymentPolicy: {
        reserveAddress: 'bc1qwrong'
      }
    },
    env: {}
  })
);

assertRejects('bad target', /Prospect pipeline target/, () =>
  buildRevenueCycleStatus({
    ...baseInputs,
    prospectPipeline: {
      ...baseInputs.prospectPipeline,
      target: {
        reserveTargetSats: '999'
      }
    },
    env: {}
  })
);

assertRejects('unsafe next action', /avoid prohibited routes/, () =>
  validateRevenueCycleStatus({
    ...status,
    nextAction: 'Use fake engagement and pump the market.'
  })
);

const publicInputs = await readPublicInputs();
const expectedPublicStatus = buildRevenueCycleStatus({ ...publicInputs, env: {} });
validateRevenueCycleStatus(expectedPublicStatus);
const publishedPublicStatus = await readJson(join('public', 'revenue-cycle-status.json'));
assertDeepEqual(publishedPublicStatus, expectedPublicStatus, 'public revenue-cycle-status.json');
await assertRevenueStateMutatorsRefreshPublicStatus();

console.log(
  'Revenue cycle status check passed: the operating dashboard preserves revenue-first reserve gates.'
);

function assertEqual(actual, expected) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

function assertIncludes(value, expected) {
  const haystack = Array.isArray(value) ? value.join('\n') : String(value);
  if (!haystack.includes(expected)) throw new Error(`Expected value to include: ${expected}`);
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label} must match the generated revenue cycle status.`);
  }
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

async function readPublicInputs() {
  return {
    report: await readJson(join('public', 'transparency', 'latest.json')),
    revenuePlan: await readJson(join('public', 'revenue-operating-plan.json')),
    ledger: await readJson(join('public', 'sats-generation-ledger.json')),
    invoiceQueue: await readJson(join('public', 'sats-invoice-queue.json')),
    prospectPipeline: await readJson(join('public', 'sats-prospect-pipeline.json')),
    outreachPacketQueue: await readJson(join('public', 'service-outreach-packet-queue.json')),
    inboundLeadQueue: await readJson(join('public', 'inbound-service-lead-queue.json')),
    paidPromotionLedger: await readJson(join('public', 'paid-promotion-ledger.json')),
    referralPartnerPolicy: await readJson(join('public', 'referral-partner-policy.json')),
    referralPartnerHandoffQueue: await readJson(
      join('public', 'referral-partner-handoff-queue.json')
    ),
    referralPartnerHandoffPacket: await readOptionalJson(
      join('public', 'referral-partner-handoff-packet.json')
    ),
    approvalQueue: await readJson(join('public', 'executive-approval-queue.json')),
    socialQueue: await readJson(join('public', 'social-agent-content-queue.json'))
  };
}

function completedPaidPromotionStatusInput() {
  return {
    paidPromotionLedger: {
      campaigns: [
        {
          id: 'campaign-1',
          status: 'completed',
          promoter: {
            displayName: 'Diana Crypto',
            handle: '142C_'
          },
          reportedPostUrl: 'https://x.com/142C_/status/2086570576530010172',
          conversion: {
            confirmedReceiptsSats: '0'
          }
        }
      ]
    },
    prospectPipeline: {
      ...baseInputs.prospectPipeline,
      prospects: [
        {
          id: 'prospect-1',
          stage: 'outreach-approved'
        }
      ]
    },
    outreachPacketQueue: {
      packets: [
        {
          id: 'outreach-packet-1',
          status: 'ready-for-manual-send'
        }
      ]
    }
  };
}

async function assertRevenueStateMutatorsRefreshPublicStatus() {
  const publicStateSource = await readFile('scripts/lib/revenue-cycle-public-state.mjs', 'utf8');
  for (const expectedArtifact of [
    'revenue-cycle-status.json',
    'revenue-execution-brief.json',
    'revenue-execution-brief.md',
    'outreach-dispatch-brief.json',
    'outreach-dispatch-brief.md',
    'reply-conversion-brief.json',
    'reply-conversion-brief.md',
    'referral-handoff-dispatch-brief.json',
    'referral-handoff-dispatch-brief.md'
  ]) {
    if (!publicStateSource.includes(expectedArtifact)) {
      throw new Error(`Revenue public-state refresh must write ${expectedArtifact}.`);
    }
  }

  const mutators = [
    'scripts/approved-followthrough-agent.mjs',
    'scripts/executive-approval-agent.mjs',
    'scripts/inbound-service-lead-agent.mjs',
    'scripts/paid-promotion-agent.mjs',
    'scripts/reserve-growth-agent.mjs',
    'scripts/sats-invoice-quote-agent.mjs',
    'scripts/sats-outreach-approval-agent.mjs',
    'scripts/sats-prospect-follow-up-agent.mjs',
    'scripts/sats-prospect-response-agent.mjs',
    'scripts/sats-prospect-review-agent.mjs',
    'scripts/sats-prospect-stage-agent.mjs',
    'scripts/service-outreach-packet-agent.mjs',
    'scripts/x-social-agent.mjs'
  ];

  const staleMutators = [];
  for (const path of mutators) {
    const source = await readFile(path, 'utf8');
    if (!source.includes('writeRevenueCyclePublicStatus')) staleMutators.push(path);
  }
  if (staleMutators.length > 0) {
    throw new Error(
      `Revenue state mutators must refresh public revenue-cycle status:\n- ${staleMutators.join('\n- ')}`
    );
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
