import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOutreachContactEvidenceDraft } from './lib/outreach-contact-evidence-parser.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const OUTREACH_PACKET_QUEUE_PATH = join('public', 'service-outreach-packet-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const [pipeline, packetQueue] = await Promise.all([
    readJson(PIPELINE_PATH),
    readJson(OUTREACH_PACKET_QUEUE_PATH)
  ]);

  switch (command) {
    case 'plan':
      printPlan();
      break;
    case 'render-template':
      printIssueTemplate(args, { packetQueue });
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], { pipeline, packetQueue });
      break;
    default:
      throw new Error(
        `Unknown outreach contact evidence command: ${command}. Use plan, render-template --packet <id>, or draft-from-issue-json <path>.`
      );
  }
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: 'SATA Reserve Token',
        mode: 'outreach-contact-evidence-intake',
        issueTemplate: '.github/ISSUE_TEMPLATE/outreach-contact-evidence.yml',
        requiredFields: [
          'packetId',
          'prospectId',
          'contactChannel',
          'contactEvidenceUrl',
          'approvedMessageSha256',
          'exactMessageSent',
          'sentAtUtc'
        ],
        nextOperatingAction:
          'After a human sends approved outreach, submit the contact evidence issue and run the rendered mark-sent command only if the pasted message and approved SHA-256 match the packet.',
        templateCommand:
          'node scripts/outreach-contact-evidence-agent.mjs render-template --packet "<packet-id>" --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"',
        boundary:
          'This agent parses evidence only. It does not contact prospects, approve invoices, send payment instructions, publish posts, grant tokens, or move assets.'
      },
      null,
      2
    )
  );
}

function printIssueTemplate(args, context) {
  const options = parseOptions(args);
  console.log(
    renderOutreachContactEvidenceIssueBody({
      packetQueue: context.packetQueue,
      packetId: options.packet,
      contactChannel: options.channel,
      contactEvidenceUrl: options.evidence,
      sentAtUtc: options.sentAtUtc
    })
  );
}

export function renderOutreachContactEvidenceIssueBody({
  packetQueue,
  packetId,
  contactChannel,
  contactEvidenceUrl = '<contact-evidence-url-or-reference>',
  sentAtUtc = '<sent-at-utc>'
}) {
  const packet = findReadyPacket(packetQueue, packetId);
  return [
    `### Outreach packet ID`,
    packet.id,
    '',
    `### Prospect ID`,
    packet.prospectId,
    '',
    `### Contact channel`,
    cleanLine(contactChannel ?? packet.channel),
    '',
    `### Contact evidence URL or reference`,
    cleanLine(contactEvidenceUrl),
    '',
    `### Approved message SHA-256`,
    packet.messageSha256,
    '',
    `### Exact message sent`,
    packet.message,
    '',
    `### Sent at UTC`,
    cleanLine(sentAtUtc)
  ].join('\n');
}

async function draftFromIssueJson(path, context) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildOutreachContactEvidenceDraft({ issue, ...context }), null, 2));
}

function findReadyPacket(packetQueue, packetId) {
  const id = cleanLine(packetId);
  if (!id) throw new Error('Missing --packet value.');
  const packet = (packetQueue.packets ?? []).find((item) => item.id === id);
  if (!packet) throw new Error(`Outreach packet not found: ${id}`);
  if (packet.status !== 'ready-for-manual-send') {
    throw new Error(`${id}: evidence template requires a ready-for-manual-send packet.`);
  }
  if (!packet.message || !/^[a-f0-9]{64}$/.test(packet.messageSha256 ?? '')) {
    throw new Error(`${id}: packet must include approved message and SHA-256.`);
  }
  return packet;
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error('Options must be provided as --key value pairs.');
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

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
