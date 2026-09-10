import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildInboundLeadPlan, recordInboundLead } from './lib/inbound-service-leads.mjs';
import { buildAuditIntakeDraft } from './lib/audit-intake-parser.mjs';
import { recordReferralHandoffLeadConversion } from './lib/referral-partner-handoffs.mjs';
import { writeRevenueCyclePublicStatus } from './lib/revenue-cycle-public-state.mjs';

const QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const DELIVERY_KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const PAID_PROMOTION_PATH = join('public', 'paid-promotion-ledger.json');
const REFERRAL_HANDOFF_PATH = join('public', 'referral-partner-handoff-queue.json');
const SOCIAL_QUEUE_PATH = join('public', 'social-agent-content-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const options = parseOptions(args);
const [queue, paidPromotionLedger, referralHandoffQueue, socialQueue] = await Promise.all([
  readJson(QUEUE_PATH),
  readJson(PAID_PROMOTION_PATH),
  readJson(REFERRAL_HANDOFF_PATH),
  readJson(SOCIAL_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
  case 'json':
    console.log(
      JSON.stringify(buildInboundLeadPlan({ queue, paidPromotionLedger, socialQueue }), null, 2)
    );
    break;
  case 'record-lead':
    {
      const nextQueue = recordInboundLead({
        queue,
        leadId: options.lead,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        contactHandle: options.contactHandle,
        publicProfileUrl: options.publicProfileUrl,
        projectUrl: options.projectUrl,
        requestedOfferId: options.offer,
        evidence: options.evidence,
        customerAskedForInvoice: /^true$/i.test(options.customerAskedForInvoice ?? ''),
        notes: options.notes,
        recordedAtUtc: options.recordedAtUtc
      });
      const nextReferralHandoffQueue =
        options.sourceType === 'manual-referral'
          ? recordReferralHandoffLeadConversion({
              queue: referralHandoffQueue,
              sourceId: options.sourceId,
              leadId: options.lead,
              evidence: options.evidence,
              convertedAtUtc: options.convertedAtUtc ?? options.recordedAtUtc
            })
          : referralHandoffQueue;
      await writeQueue({ nextQueue, nextReferralHandoffQueue });
    }
    break;
  case 'record-from-intake-issue-json':
    {
      const issuePath = options.issue ?? options.path;
      if (!issuePath) throw new Error('Missing --issue <path-to-issue-json>.');
      if (!options.recordedAtUtc) {
        throw new Error('Missing --recordedAtUtc <recorded-at-utc> for intake lead evidence.');
      }
      const [issue, deliveryKit, invoiceQueue] = await Promise.all([
        readJson(issuePath),
        readJson(DELIVERY_KIT_PATH),
        readJson(INVOICE_QUEUE_PATH)
      ]);
      const draft = buildAuditIntakeDraft({
        issue,
        deliveryKit,
        prospectPipeline: null,
        invoiceQueue
      });
      if (draft.missingRequiredFields.length > 0) {
        throw new Error(
          `Cannot record incomplete intake issue; missing ${draft.missingRequiredFields.join(', ')}.`
        );
      }
      const nextQueue = recordInboundLead({
        queue,
        leadId: options.lead ?? draft.inboundLeadDraft.id,
        sourceType: draft.inboundLeadDraft.sourceType,
        sourceId: draft.inboundLeadDraft.sourceId,
        contactHandle: draft.inboundLeadDraft.contactHandle,
        publicProfileUrl: draft.inboundLeadDraft.publicProfileUrl,
        projectUrl: draft.inboundLeadDraft.projectUrl,
        requestedOfferId: draft.inboundLeadDraft.requestedOfferId,
        evidence: options.evidence ?? draft.inboundLeadDraft.evidence,
        customerAskedForInvoice: draft.inboundLeadDraft.customerAskedForInvoice,
        notes: options.notes ?? 'Recorded from transparency-audit intake issue.',
        recordedAtUtc: options.recordedAtUtc
      });
      await writeQueue({ nextQueue, nextReferralHandoffQueue: referralHandoffQueue });
    }
    break;
  default:
    throw new Error(
      `Unknown inbound lead command: ${command}. Use plan, json, record-lead, or record-from-intake-issue-json.`
    );
}

async function writeQueue({ nextQueue, nextReferralHandoffQueue }) {
  await writeFile(QUEUE_PATH, `${JSON.stringify(nextQueue, null, 2)}\n`);
  await writeFile(REFERRAL_HANDOFF_PATH, `${JSON.stringify(nextReferralHandoffQueue, null, 2)}\n`);
  await writeRevenueCyclePublicStatus();
  console.log(
    JSON.stringify(
      buildInboundLeadPlan({ queue: nextQueue, paidPromotionLedger, socialQueue }),
      null,
      2
    )
  );
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}`);
    parsed[key.slice(2)] = collected.join(' ');
  }
  return parsed;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
