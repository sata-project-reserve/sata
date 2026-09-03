import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const options = parseOptions(args);
  const [status, packetQueue, approvalQueue] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'service-outreach-packet-queue.json')),
    readJson(join('public', 'executive-approval-queue.json'))
  ]);
  const brief = buildOutreachDispatchBrief({
    status,
    packetQueue,
    approvalQueue,
    maxManualSends: options.max ? Number(options.max) : undefined
  });

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

export function buildOutreachDispatchBrief({
  status,
  packetQueue,
  approvalQueue,
  maxManualSends = 5
}) {
  if (!Number.isSafeInteger(maxManualSends) || maxManualSends < 1 || maxManualSends > 20) {
    throw new Error('maxManualSends must be an integer from 1 to 20.');
  }
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
  const sprintPackets = readyPackets.slice(0, maxManualSends);
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
    maxManualSends,
    readyManualSendCount: readyPackets.length,
    queuedRemainderCount: Math.max(readyPackets.length - sprintPackets.length, 0),
    readyManualSends: sprintPackets,
    pendingOutreachApprovals,
    dispatchRule:
      'Run one focused manual sprint: send the listed packets exactly as approved, record evidence after each send, then stop and review replies before expanding the batch.',
    nextAction:
      sprintPackets[0]?.packetId
        ? `Send ${sprintPackets[0].packetId} exactly as approved, then record contact evidence.`
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
    '## Ready Manual Sends',
    `Sprint: ${brief.readyManualSends.length} of ${brief.readyManualSendCount} ready packets. Backlog after this sprint: ${brief.queuedRemainderCount}.`,
    '',
    brief.dispatchRule
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

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}.`);
    options[key.slice(2)] = collected.join(' ');
  }
  return options;
}
