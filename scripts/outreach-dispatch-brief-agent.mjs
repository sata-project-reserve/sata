import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const [status, packetQueue, approvalQueue] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'service-outreach-packet-queue.json')),
    readJson(join('public', 'executive-approval-queue.json'))
  ]);
  const brief = buildOutreachDispatchBrief({ status, packetQueue, approvalQueue });

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(brief, null, 2));
      break;
    case 'markdown':
      console.log(renderOutreachDispatchMarkdown(brief));
      break;
    default:
      throw new Error(`Unknown outreach dispatch brief command: ${command}. Use plan, json, or markdown.`);
  }
}

export function buildOutreachDispatchBrief({ status, packetQueue, approvalQueue }) {
  const readyPackets = (packetQueue.packets ?? [])
    .filter((packet) => packet.status === 'ready-for-manual-send')
    .map((packet) => ({
      packetId: packet.id,
      prospectId: packet.prospectId,
      channel: packet.channel,
      destination: packet.destination,
      message: packet.message,
      recordContactCommand: packet.recordContactCommand,
      boundary: packet.boundary
    }));
  const pendingOutreachApprovals = (approvalQueue.items ?? [])
    .filter(
      (item) =>
        item.status === 'ready-for-chairman-review' && item.id?.startsWith('outreach-approval-')
    )
    .map((item) => ({
      approvalId: item.id,
      title: item.title,
      prospectIds: prospectIdsFromOutreachApprovalTitle(item.title),
      approveCommand: `npm run ops:approve -- ${item.id} --confirm-chairman-approval "I am Executive Chairman and approve ${item.id}"`,
      evidenceCount: item.evidence?.length ?? 0,
      boundary:
        'Approval records a chairman decision only; it does not contact prospects, approve invoices, move assets, or make public commitments.'
    }));

  return {
    project: status.project,
    mode: 'manual-outreach-dispatch-brief',
    generatedAtUtc: new Date().toISOString(),
    reserve: status.currentReserve,
    readyManualSends: readyPackets,
    pendingOutreachApprovals,
    nextAction:
      readyPackets[0]?.packetId
        ? `Send ${readyPackets[0].packetId} exactly as approved, then record contact evidence.`
        : pendingOutreachApprovals[0]?.approvalId
          ? `Chairman decision needed for ${pendingOutreachApprovals[0].approvalId}.`
          : status.nextAction,
    boundary:
      'This brief is for manual dispatch coordination only. It does not approve outreach, contact prospects, send invoices, request payment, move assets, grant tokens, or make public commitments.'
  };
}

export function renderOutreachDispatchMarkdown(brief) {
  const lines = [
    `# ${brief.project} Outreach Dispatch Brief`,
    '',
    `Generated: ${brief.generatedAtUtc}`,
    `Reserve: ${brief.reserve.confirmedSats} sats confirmed, ${brief.reserve.remainingSats} sats remaining.`,
    '',
    '## Boundary',
    brief.boundary,
    '',
    '## Ready Manual Sends'
  ];
  if (brief.readyManualSends.length === 0) {
    lines.push('No outreach packets are ready for manual send.');
  }
  for (const packet of brief.readyManualSends) {
    lines.push(
      '',
      `### ${packet.prospectId}`,
      `Packet: ${packet.packetId}`,
      `Destination: ${packet.destination.publicProfileUrl}`,
      '',
      '```text',
      packet.message,
      '```',
      '',
      'After manual send, record durable evidence:',
      '',
      '```sh',
      packet.recordContactCommand,
      '```'
    );
  }

  lines.push('', '## Pending Chairman Outreach Approvals');
  if (brief.pendingOutreachApprovals.length === 0) {
    lines.push('No outreach approval packets are pending.');
  }
  for (const item of brief.pendingOutreachApprovals) {
    lines.push(
      '',
      `### ${item.approvalId}`,
      item.title,
      `Prospects: ${item.prospectIds.join(', ')}`,
      `Evidence records: ${item.evidenceCount}`,
      '',
      '```sh',
      item.approveCommand,
      '```'
    );
  }

  lines.push('', '## Next Action', brief.nextAction);
  return `${lines.join('\n')}\n`;
}

function prospectIdsFromOutreachApprovalTitle(title) {
  const match = /^Approve factual outreach to (?<ids>.+)$/i.exec(title ?? '');
  return (match?.groups?.ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
