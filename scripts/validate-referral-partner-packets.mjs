import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReferralPartnerPacket,
  renderReferralPartnerPacket,
  validateReferralPartnerPacket
} from './referral-partner-packet-agent.mjs';

const policy = readJson(join('public', 'referral-partner-policy.json'));
const inboundQueue = readJson(join('public', 'inbound-service-lead-queue.json'));
const agent = readFileSync(join('scripts', 'referral-partner-packet-agent.mjs'), 'utf8');
const findings = [];

const packet = buildReferralPartnerPacket({
  policy,
  inboundQueue,
  partnerId: 'diana-crypto',
  displayName: 'Diana Crypto',
  handle: '142C_',
  sourceEvidence: 'DM evidence showing post-receipt referral terms were requested.',
  requestedCompensation: '10% post-receipt referral share'
});
const rendered = renderReferralPartnerPacket(packet);

validateReferralPartnerPacket({ packet, policy, inboundQueue });

if (packet.source.sourceType !== 'manual-referral') {
  findings.push('packet must use manual-referral source type');
}
if (!packet.source.serviceUrl.includes('utm_source=referral_diana_crypto')) {
  findings.push('packet must generate a partner-specific service tracking URL');
}
if (!packet.source.sampleAuditUrl.includes('/services/sample-audit?')) {
  findings.push('packet must generate a tracked sample audit URL');
}
if (!/Sample audit:/i.test(rendered) || !/services\/sample-audit/i.test(packet.replyTemplate)) {
  findings.push('rendered packet and reply template must include the sample audit link');
}
if (!packet.recordReferredLeadCommand.includes('--customerAskedForInvoice false')) {
  findings.push('packet must record referred customers before invoice request status');
}
if (!/compensation is considered only after a referred customer pays/i.test(packet.replyTemplate)) {
  findings.push('reply template must preserve post-receipt compensation');
}
if (!/Separate token grant approval required: true/i.test(rendered)) {
  findings.push('rendered packet must surface separate token grant approval');
}
if (!/does not approve the partner/i.test(rendered)) {
  findings.push('rendered packet must preserve no-approval boundary');
}
if (!/render|markdown/.test(agent)) {
  findings.push('agent must expose render or markdown command');
}

if (findings.length > 0) {
  console.error('Referral partner packet check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Referral partner packet check passed: partner referrals stay tracked, disclosed, and post-receipt.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
