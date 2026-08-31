import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  appendApprovedProspectOutreachPacket,
  buildApprovedProspectOutreachPacketRecord,
  renderApprovedProspectOutreachPacket,
  renderOutreachPacket,
  validateOutreachPacketQueue
} from './service-outreach-packet-agent.mjs';

const pipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const deliveryKit = readJson(join('public', 'transparency-audit-delivery-kit.json'));
const packet = renderOutreachPacket({
  pipeline,
  deliveryKit,
  templateId: 'transparency-audit-first-contact',
  prospectName: 'Example Team',
  publicProfileUrl: 'https://x.com/example',
  projectUrl: 'https://example.invalid'
});
const approvedPipeline = {
  ...pipeline,
  prospects: [
    {
      id: 'approved-team',
      stage: 'outreach-approved',
      source: 'test',
      publicProfileUrl: 'https://x.com/approved',
      projectUrl: 'https://approved.invalid',
      observedClaim: 'Public transparency claims need an evidence review.',
      recommendedOfferId: 'transparency-audit',
      chairmanApprovedBeforeOutreach: true,
      evidence: ['https://approved.invalid'],
      outreachApprovalId: 'outreach-approval-20260831-approved-team'
    },
    {
      id: 'identified-team',
      stage: 'identified',
      source: 'test',
      publicProfileUrl: 'https://x.com/identified',
      projectUrl: 'https://identified.invalid',
      observedClaim: 'Public transparency claims need an evidence review.',
      recommendedOfferId: 'transparency-audit',
      chairmanApprovedBeforeOutreach: false,
      evidence: ['https://identified.invalid']
    }
  ]
};
const approvedPacket = renderApprovedProspectOutreachPacket({
  pipeline: approvedPipeline,
  deliveryKit,
  prospectId: 'approved-team'
});
const approvedRecord = buildApprovedProspectOutreachPacketRecord({
  pipeline: approvedPipeline,
  deliveryKit,
  prospectId: 'approved-team',
  generatedAtUtc: '2026-08-31T16:45:00.000Z'
});
const packetQueue = appendApprovedProspectOutreachPacket({
  queue: null,
  pipeline: approvedPipeline,
  deliveryKit,
  prospectId: 'approved-team',
  generatedAtUtc: '2026-08-31T16:45:00.000Z'
});
const findings = [];

for (const required of [
  /transparency audit/i,
  /starter audit is \$50/i,
  /No price promotion/i,
  /no investor targeting/i,
  /no market-support promises/i,
  /services\/transparency-audit/i,
  /transparency-audit-intake\.yml/i,
  /Executive Chairman approval/i
]) {
  if (!required.test(packet)) findings.push(`outreach packet missing ${required}`);
}

for (const required of [
  /approved-team/i,
  /https:\/\/x\.com\/approved/i,
  /https:\/\/approved\.invalid/i,
  /Executive Chairman approval/i
]) {
  if (!required.test(approvedPacket)) findings.push(`approved outreach packet missing ${required}`);
}

if (approvedRecord.status !== 'ready-for-manual-send') {
  findings.push('approved outreach record must be ready-for-manual-send');
}
if (approvedRecord.outreachApprovalId !== 'outreach-approval-20260831-approved-team') {
  findings.push('approved outreach record must include outreach approval id');
}
if (!/record-contacted/i.test(approvedRecord.recordContactCommand)) {
  findings.push('approved outreach record must include contact evidence command');
}
validateOutreachPacketQueue({ queue: packetQueue, pipeline: approvedPipeline });

const publicQueue = readOptionalJson(join('public', 'service-outreach-packet-queue.json'));
if (publicQueue) validateOutreachPacketQueue({ queue: publicQueue, pipeline });

assertRejects('identified prospect render', /requires outreach-approved stage/i, () =>
  renderApprovedProspectOutreachPacket({
    pipeline: approvedPipeline,
    deliveryKit,
    prospectId: 'identified-team'
  })
);
assertRejects('unknown prospect render', /Prospect not found/i, () =>
  renderApprovedProspectOutreachPacket({
    pipeline: approvedPipeline,
    deliveryKit,
    prospectId: 'missing-team'
  })
);
assertRejects('duplicate active packet', /active outreach packet already exists/i, () =>
  appendApprovedProspectOutreachPacket({
    queue: packetQueue,
    pipeline: approvedPipeline,
    deliveryKit,
    prospectId: 'approved-team'
  })
);

for (const prohibited of [
  /\bpump\b/i,
  /\bguaranteed buyers\b/i,
  /\bfake engagement\b/i,
  /\bbots\b/i,
  /\braids\b/i,
  /\bprice prediction\b/i,
  /\bpayment instruction\b/i
]) {
  const allowedBoundary =
    /payment instruction/i.test(String(prohibited)) &&
    /approval is required before .*payment instruction/i.test(packet);
  if (prohibited.test(packet) && !allowedBoundary) {
    findings.push(`outreach packet contains prohibited wording ${prohibited}`);
  }
}

if (findings.length > 0) {
  console.error('Service outreach packet check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Service outreach packet check passed: manual outreach drafts are bounded and reviewable.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  try {
    return readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
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
