import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProspectReviewPacket, renderProspectReviewPacket } from './lib/prospect-review-packet.mjs';

const pipeline = JSON.parse(readFileSync(join('public', 'sats-prospect-pipeline.json'), 'utf8'));
const packet = buildProspectReviewPacket({
  pipeline,
  generatedAtUtc: '2026-08-29T08:30:00.000Z'
});
const rendered = renderProspectReviewPacket({
  pipeline,
  generatedAtUtc: '2026-08-29T08:30:00.000Z'
});
const findings = [];

if (packet.mode !== 'chairman-prospect-review-packet') {
  findings.push('packet mode must be chairman-prospect-review-packet');
}
if (packet.candidateCount > pipeline.dailyCadence.chairmanReviewBatchSize) {
  findings.push('packet must not exceed chairmanReviewBatchSize');
}
if (packet.candidateCount === 0 && (pipeline.prospects ?? []).some((prospect) => prospect.stage === 'identified')) {
  findings.push('packet must include identified candidates when they exist');
}
for (const candidate of packet.candidates) {
  const source = (pipeline.prospects ?? []).find((prospect) => prospect.id === candidate.id);
  if (!source) findings.push(`${candidate.id}: candidate must exist in the pipeline`);
  if (source && source.stage !== 'identified') {
    findings.push(`${candidate.id}: review packet may only include identified candidates`);
  }
  if (source && source.chairmanApprovedBeforeOutreach !== false) {
    findings.push(`${candidate.id}: review packet candidates must not be outreach-approved`);
  }
  for (const field of ['publicProfileUrl', 'projectUrl', 'observedClaim', 'recommendedOfferId']) {
    if (!candidate[field]) findings.push(`${candidate.id}: missing ${field}`);
  }
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
    findings.push(`${candidate.id}: missing evidence`);
  }
  if (!/Executive Chairman must approve/i.test(candidate.requiredApproval ?? '')) {
    findings.push(`${candidate.id}: missing Executive Chairman approval gate`);
  }
}

for (const required of [
  /SATA Prospect Review Packet/i,
  /Observed public claim/i,
  /Proposed next stage: chairman-review/i,
  /Executive Chairman must approve/i,
  /does not approve contact/i,
  /asset movement/i
]) {
  if (!required.test(rendered)) findings.push(`rendered packet missing ${required}`);
}

for (const prohibited of [
  /\boutreach-approved\b/i,
  /\bapproved invoice\b/i,
  /\bpayment request approved\b/i,
  /\btoken grant approved\b/i,
  /\bprice guarantee\b/i,
  /\bguaranteed buyers\b/i,
  /\bfake engagement\b/i
]) {
  if (prohibited.test(rendered)) findings.push(`rendered packet contains prohibited claim ${prohibited}`);
}

if (findings.length > 0) {
  console.error('Sats prospect review packet check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats prospect review packet check passed: identified leads can be batched for chairman review without outreach approval.');
