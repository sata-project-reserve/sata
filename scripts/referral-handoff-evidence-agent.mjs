import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralHandoffEvidenceDraft } from './lib/referral-handoff-evidence-parser.mjs';

const QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');
const PAID_PROMOTION_PATH = join('public', 'paid-promotion-ledger.json');
const REFERRAL_POLICY_PATH = join('public', 'referral-partner-policy.json');
const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const context = await readContext();

  switch (command) {
    case 'plan':
      console.log(
        JSON.stringify(
          {
            project: context.queue.project,
            mode: 'referral-handoff-evidence-intake',
            issueTemplate: '.github/ISSUE_TEMPLATE/referral-handoff-evidence.yml',
            nextAction:
              'After approved referral handoff terms are sent manually, submit the evidence issue and run the rendered record-sent command only if the pasted terms and approved SHA-256 match the packet.',
            boundary:
              'This intake does not send referral terms, approve compensation, approve invoices, send payment instructions, grant tokens, publish posts, or move assets.'
          },
          null,
          2
        )
      );
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], context);
      break;
    default:
      throw new Error(
        `Unknown referral handoff evidence command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

async function draftFromIssueJson(path, context) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildReferralHandoffEvidenceDraft({ issue, ...context }), null, 2));
}

async function readContext() {
  const [queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue] = await Promise.all([
    readJson(QUEUE_PATH),
    readJson(PAID_PROMOTION_PATH),
    readJson(REFERRAL_POLICY_PATH),
    readJson(INBOUND_QUEUE_PATH)
  ]);
  return { queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
