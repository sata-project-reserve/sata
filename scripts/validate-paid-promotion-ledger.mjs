import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPaidPromotionPlan,
  recordPaidPromotionConversion,
  recordPaidPromotionVerification,
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
if (
  !/record-live --campaign diana-crypto-20260903-transparency-tweet/.test(
    plan.awaitingVerification[0]?.recordLiveCommand ?? ''
  )
) {
  findings.push('plan must expose live verification record command');
}

const verified = recordPaidPromotionVerification({
  ledger,
  campaignId: 'diana-crypto-20260903-transparency-tweet',
  verifiedPostUrl: 'https://x.com/142C_/status/2086570576530010172',
  evidence: 'signed-in-browser-screenshot-20260903',
  verifiedAtUtc: '2026-09-03T20:00:00.000Z'
});
if (verified.campaigns[0]?.status !== 'live-verified') {
  findings.push('record-live must mark campaign live-verified');
}
const completed = recordPaidPromotionConversion({
  ledger: verified,
  campaignId: 'diana-crypto-20260903-transparency-tweet',
  evidence: '24-hour-x-analytics-and-inquiry-log',
  profileViewLift: 'profile views increased; exact analytics archived separately',
  trackedClicks: 0,
  serviceInquiries: 0,
  invoiceRequests: 0,
  confirmedReceiptsSats: '0',
  measuredAtUtc: '2026-09-04T20:00:00.000Z'
});
if (completed.campaigns[0]?.status !== 'completed') {
  findings.push('record-conversion must mark live-verified campaign completed');
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

assertRejects('conversion before verification', /live-verified status/i, () =>
  recordPaidPromotionConversion({
    ledger,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    evidence: 'analytics-log',
    serviceInquiries: 0,
    invoiceRequests: 0,
    confirmedReceiptsSats: '0'
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
