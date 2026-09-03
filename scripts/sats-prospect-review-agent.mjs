import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProspectReviewPacket, renderProspectReviewPacket } from './lib/prospect-review-packet.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const APPROVAL_QUEUE_PATH = join('public', 'executive-approval-queue.json');
const [, , command = 'plan'] = process.argv;
const pipeline = await readJson(PIPELINE_PATH);

switch (command) {
  case 'plan':
    console.log(JSON.stringify(buildProspectReviewPacket({ pipeline }), null, 2));
    break;
  case 'render':
    console.log(renderProspectReviewPacket({ pipeline }));
    break;
  case 'write-draft':
    await writeDraft();
    break;
  default:
    throw new Error(`Unknown sats-prospect-review command: ${command}. Use plan, render, or write-draft.`);
}

async function writeDraft() {
  const approvalQueue = await readJson(APPROVAL_QUEUE_PATH);
  const packet = buildProspectReviewPacket({ pipeline });
  if (packet.candidates.length === 0) {
    throw new Error('No identified prospects are available for chairman review.');
  }
  const approvalItem = buildApprovalItem(packet);
  if ((approvalQueue.items ?? []).some((item) => item.id === approvalItem.id)) {
    throw new Error(`${approvalItem.id} already exists in executive approval queue.`);
  }
  const updated = {
    ...approvalQueue,
    updatedAtUtc: approvalItem.createdAtUtc,
    items: [...(approvalQueue.items ?? []), approvalItem]
  };
  await writeFile(APPROVAL_QUEUE_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(JSON.stringify(approvalItem, null, 2));
}

function buildApprovalItem(packet) {
  const dateId = packet.generatedAtUtc.slice(0, 10).replaceAll('-', '');
  const candidateIds = packet.candidates.map((candidate) => candidate.id);
  return {
    id: `prospect-review-batch-${dateId}-${candidateIds.join('-').replace(/[^a-z0-9-]/g, '-')}`,
    title: 'Review next public-evidence prospect batch',
    category: 'revenue-action',
    status: 'ready-for-chairman-review',
    createdAtUtc: packet.generatedAtUtc,
    preparedBy: 'codex-ops',
    summary: `Review ${candidateIds.join(', ')} as the next identified transparency-audit prospects.`,
    rationale:
      'The prospect-review packet is rendered and validated. A fresh approved review item lets exactly this batch advance while outreach, invoices, payment requests, paid work, token grants, and asset movement remain separately gated.',
    proposedAction: `Review ${candidateIds.join(', ')} using npm run ops:prospect-review-plan. If acceptable, approve this item to allow only those records to move to chairman-review. This item does not approve contact, invoices, payment requests, paid work, token grants, or asset movement.`,
    execution: 'manual-chairman-action',
    requiredChairmanApproval: true,
    riskReview: [
      'Candidates are recorded from public pages only and remain at identified stage until this item is approved.',
      'No outreach occurs from this approval item.',
      'No invoice, payment instruction, paid work, or token grant is approved by this item.',
      'Observed claims are treated as public claims to review, not accusations or endorsements.'
    ],
    publicDisclosure:
      'SATA may sell transparency tooling and public-reporting services. No price guarantee, no redemption promise, no revenue guarantee, and no market-support commitment.',
    evidence: packet.candidates.flatMap((candidate) =>
      candidate.evidence.map((url) => ({
        type: 'prospect-evidence',
        url
      }))
    )
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
