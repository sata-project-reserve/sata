import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPaidPromotionPlan,
  validatePaidPromotionLedger
} from './lib/paid-promotion-ledger.mjs';

const ledger = JSON.parse(readFileSync(join('public', 'paid-promotion-ledger.json'), 'utf8'));
const findings = [];

validatePaidPromotionLedger(ledger);
const plan = buildPaidPromotionPlan({ ledger, generatedAtUtc: '2026-09-03T19:00:00.000Z' });

if (plan.mode !== 'paid-promotion-control-plan') {
  findings.push('plan mode must be paid-promotion-control-plan');
}
if (plan.totals.awaitingVerification !== 1) {
  findings.push('Diana test campaign must remain awaiting verification');
}
if (plan.totals.confirmedReceiptsSats !== '0') {
  findings.push('paid promotion must not fabricate confirmed reserve sats');
}
if (!/does not approve promotion/i.test(plan.boundary ?? '')) {
  findings.push('plan boundary must preserve no autonomous promotion approval');
}
if (!plan.awaitingVerification[0]?.reportedPostUrl?.includes('/status/2086570576530010172')) {
  findings.push('plan must expose the user-supplied Diana status URL for verification');
}

assertRejects('missing chairman approval', /executive-chairman approval/i, () =>
  validatePaidPromotionLedger({
    ...ledger,
    campaigns: [
      {
        ...ledger.campaigns[0],
        approval: {
          ...ledger.campaigns[0].approval,
          approvedBy: 'agent'
        }
      }
    ]
  })
);

assertRejects('missing disclosure', /Sponsored \| Paid Partnership/i, () =>
  validatePaidPromotionLedger({
    ...ledger,
    campaigns: [
      {
        ...ledger.campaigns[0],
        approval: {
          ...ledger.campaigns[0].approval,
          requiredDisclosure: 'ad'
        }
      }
    ]
  })
);

assertRejects('bad post url', /reportedPostUrl/i, () =>
  validatePaidPromotionLedger({
    ...ledger,
    campaigns: [
      {
        ...ledger.campaigns[0],
        reportedPostUrl: 'https://example.com/not-a-tweet'
      }
    ]
  })
);

assertRejects('fake sats conversion', /confirmedReceiptsSats/i, () =>
  validatePaidPromotionLedger({
    ...ledger,
    campaigns: [
      {
        ...ledger.campaigns[0],
        conversion: {
          ...ledger.campaigns[0].conversion,
          confirmedReceiptsSats: 'about 1000'
        }
      }
    ]
  })
);

if (findings.length > 0) {
  console.error('Paid promotion ledger check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Paid promotion ledger check passed: paid campaigns are disclosed, evidence-gated, and conversion-tracked.'
);

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
