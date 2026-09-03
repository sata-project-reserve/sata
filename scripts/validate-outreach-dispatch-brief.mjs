import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOutreachDispatchBrief, renderOutreachDispatchMarkdown } from './outreach-dispatch-brief-agent.mjs';

const status = readJson(join('public', 'revenue-cycle-status.json'));
const packetQueue = readJson(join('public', 'service-outreach-packet-queue.json'));
const approvalQueue = readJson(join('public', 'executive-approval-queue.json'));
const brief = buildOutreachDispatchBrief({ status, packetQueue, approvalQueue });
const markdown = renderOutreachDispatchMarkdown(brief);
const findings = [];

if (brief.mode !== 'manual-outreach-dispatch-brief') {
  findings.push('brief mode must be manual-outreach-dispatch-brief');
}
if (!/does not approve outreach/i.test(brief.boundary ?? '')) {
  findings.push('brief boundary must say it does not approve outreach');
}
if (!/does not .*move assets/i.test(brief.boundary ?? '')) {
  findings.push('brief boundary must say it does not move assets');
}
if (brief.readyManualSendCount !== status.funnel.readyOutreachPackets) {
  findings.push('ready manual send count must match revenue cycle status');
}
if (brief.readyManualSends.length !== Math.min(brief.readyManualSendCount, brief.maxManualSends)) {
  findings.push('ready manual sends must expose only the current bounded sprint');
}
if (brief.queuedRemainderCount !== Math.max(brief.readyManualSendCount - brief.readyManualSends.length, 0)) {
  findings.push('queued remainder count must match ready backlog minus sprint size');
}
if (!/focused manual sprint/i.test(brief.dispatchRule ?? '')) {
  findings.push('dispatch rule must require a focused manual sprint');
}
for (const packet of brief.readyManualSends) {
  if (!packet.message.includes('No price promotion')) {
    findings.push(`${packet.packetId}: ready message must preserve no-price-promotion language`);
  }
  if (!/mark-sent --packet/.test(packet.recordContactCommand ?? '')) {
    findings.push(`${packet.packetId}: ready packet must include a post-send evidence command`);
  }
}
for (const item of brief.pendingOutreachApprovals) {
  if (!item.approveCommand.includes(`I am Executive Chairman and approve ${item.approvalId}`)) {
    findings.push(`${item.approvalId}: approval command must require exact chairman phrase`);
  }
  if (item.prospectIds.length === 0) {
    findings.push(`${item.approvalId}: pending outreach approval must expose prospect ids`);
  }
}
if (!markdown.includes('## Ready Manual Sends')) {
  findings.push('markdown brief must include ready manual sends section');
}
if (!markdown.includes('## Pending Chairman Outreach Approvals')) {
  findings.push('markdown brief must include pending chairman outreach approvals section');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|pump)\b/i.test(markdown)) {
  findings.push('dispatch brief must not include prohibited or secret-requesting language');
}

if (findings.length > 0) {
  console.error('Outreach dispatch brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Outreach dispatch brief check passed: ready sends and pending approvals are copy-ready and bounded.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
