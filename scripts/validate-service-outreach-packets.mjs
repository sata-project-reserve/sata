import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  renderApprovedProspectOutreachPacket,
  renderOutreachPacket
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
      evidence: ['https://approved.invalid']
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
