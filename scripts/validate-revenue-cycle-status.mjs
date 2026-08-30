import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildRevenueCycleStatus, validateRevenueCycleStatus } from './lib/revenue-cycle-status.mjs';

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
assertEqual(status.social.livePostingEnabled, false);
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
assertIncludes(readyInvoiceStatus.nextAction, 'Render approved customer payment packet for invoice-ready-1');
assertEqual(readyInvoiceStatus.social.livePostingEnabled, true);

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

console.log('Revenue cycle status check passed: the operating dashboard preserves revenue-first reserve gates.');

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
    socialQueue: await readJson(join('public', 'social-agent-content-queue.json'))
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
