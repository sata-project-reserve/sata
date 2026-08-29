import {
  buildProspectResponsePlan,
  recordInvoiceRequest,
  recordProspectContact,
  validateProspectResponseEvidence
} from './lib/prospect-response-transition.mjs';

const pipeline = {
  project: 'SATA Reserve Token',
  activeCycleId: 'revenue-cycle-001',
  prospects: [
    prospect({ id: 'approved-team', stage: 'outreach-approved', approved: true }),
    {
      ...prospect({ id: 'contacted-team', stage: 'contacted', approved: true }),
      contact: {
        channel: 'manual-dm',
        evidence: 'https://x.com/example/status/1',
        contactedAtUtc: '2026-08-29T11:00:00.000Z'
      }
    },
    prospect({ id: 'identified-team', stage: 'identified', approved: false })
  ]
};
const findings = [];

const plan = buildProspectResponsePlan({ pipeline });
if (plan.mode !== 'prospect-response-transition-planner') {
  findings.push('plan mode must be prospect-response-transition-planner');
}
if (plan.outreachApproved[0]?.id !== 'approved-team') {
  findings.push('plan must include outreach-approved candidates for contact evidence');
}
if (plan.contacted[0]?.id !== 'contacted-team') {
  findings.push('plan must include contacted candidates waiting on invoice request evidence');
}
if (!/does not approve outreach/i.test(plan.boundary ?? '')) {
  findings.push('plan boundary must reject implied outreach approval');
}

const contactedPipeline = recordProspectContact({
  pipeline,
  prospectId: 'approved-team',
  contactEvidence: 'https://x.com/example/status/contact',
  contactChannel: 'manual-dm',
  contactedAtUtc: '2026-08-29T11:05:00.000Z'
});
const contacted = contactedPipeline.prospects.find((prospect) => prospect.id === 'approved-team');
if (contacted?.stage !== 'contacted') findings.push('contact transition must set contacted stage');
if (contacted?.contact?.evidence !== 'https://x.com/example/status/contact') {
  findings.push('contact transition must record evidence');
}
if (/invoice approved/i.test(contacted?.stageNotes ?? '')) {
  findings.push('contact transition must not imply invoice approval');
}

const invoicePipeline = recordInvoiceRequest({
  pipeline: contactedPipeline,
  prospectId: 'approved-team',
  requestEvidence: 'Customer asked for invoice in DM at https://x.com/example/status/request',
  requestedOfferId: 'transparency-audit',
  confirmedCustomerRequestedInvoice: true,
  requestedAtUtc: '2026-08-29T11:10:00.000Z'
});
const requested = invoicePipeline.prospects.find((prospect) => prospect.id === 'approved-team');
if (requested?.stage !== 'invoice-requested') {
  findings.push('invoice request transition must set invoice-requested stage');
}
if (requested?.invoiceRequest?.confirmedCustomerRequestedInvoice !== true) {
  findings.push('invoice request transition must record explicit customer request confirmation');
}
if (!/Exact-sats invoice still requires Executive Chairman approval/i.test(requested?.stageNotes ?? '')) {
  findings.push('invoice request transition must preserve exact-sats invoice approval gate');
}
validateProspectResponseEvidence({ pipeline: invoicePipeline });

assertRejects('contact wrong stage', /requires outreach-approved stage/i, () =>
  recordProspectContact({
    pipeline,
    prospectId: 'identified-team',
    contactEvidence: 'https://x.com/example/status/contact'
  })
);
assertRejects('contact missing evidence', /Contact evidence is required/i, () =>
  recordProspectContact({ pipeline, prospectId: 'approved-team', contactEvidence: 'short' })
);
assertRejects('invoice wrong stage', /requires contacted stage/i, () =>
  recordInvoiceRequest({
    pipeline,
    prospectId: 'approved-team',
    requestEvidence: 'Customer asked for invoice in DM.',
    confirmedCustomerRequestedInvoice: true
  })
);
assertRejects('invoice no confirmation', /confirmedCustomerRequestedInvoice=true/i, () =>
  recordInvoiceRequest({
    pipeline: contactedPipeline,
    prospectId: 'approved-team',
    requestEvidence: 'Customer asked for invoice in DM.',
    confirmedCustomerRequestedInvoice: false
  })
);
assertRejects('pipeline missing contact evidence', /requires contact evidence/i, () =>
  validateProspectResponseEvidence({
    pipeline: {
      ...pipeline,
      prospects: [prospect({ id: 'bad-contacted', stage: 'contacted', approved: true })]
    }
  })
);
assertRejects('pipeline missing invoice request evidence', /requires invoice request evidence/i, () =>
  validateProspectResponseEvidence({
    pipeline: {
      ...pipeline,
      prospects: [
        {
          ...prospect({ id: 'bad-invoice-request', stage: 'invoice-requested', approved: true }),
          contact: {
            channel: 'manual-dm',
            evidence: 'https://x.com/example/status/contact',
            contactedAtUtc: '2026-08-29T11:00:00.000Z'
          }
        }
      ]
    }
  })
);

if (findings.length > 0) {
  console.error('Sats prospect response agent check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats prospect response agent check passed: contact and invoice-request stages require evidence and keep chairman gates.');

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
