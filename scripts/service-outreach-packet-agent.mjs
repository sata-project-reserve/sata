import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const DELIVERY_KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');
const OUTREACH_PACKET_QUEUE_PATH = join('public', 'service-outreach-packet-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const [pipeline, deliveryKit, packetQueue] = await Promise.all([
    readJson(PIPELINE_PATH),
    readJson(DELIVERY_KIT_PATH),
    readOptionalJson(OUTREACH_PACKET_QUEUE_PATH)
  ]);

  switch (command) {
    case 'plan':
      printPlan(pipeline, deliveryKit);
      break;
    case 'render':
      printPacket(pipeline, deliveryKit, args);
      break;
    case 'render-approved':
      printApprovedPacket(pipeline, deliveryKit, args);
      break;
    case 'write-approved':
      await writeApprovedPacket(pipeline, deliveryKit, packetQueue, args);
      break;
    default:
      throw new Error(
        `Unknown service outreach command: ${command}. Use plan, render, render-approved, or write-approved.`
      );
  }
}

function printPlan(pipeline, deliveryKit) {
  console.log(
    JSON.stringify(
      {
        project: pipeline.project,
        mode: 'manual-service-outreach-packets',
        templates: pipeline.approvedOutreachTemplates.map((template) => ({
          id: template.id,
          offerId: template.offerId,
          channel: template.channel
        })),
        servicePage: 'https://sata-project-reserve.github.io/sata/services/transparency-audit',
        intakeUrl: deliveryKit.intakeUrl,
        nextAction:
          'Render a packet from an approved template for a qualified public-evidence prospect, then request chairman approval before outreach. Use render-approved only for outreach-approved prospect records.',
        boundary:
          'Packets are draft outreach only. They do not approve contact, invoices, paid work, token grants, or payment instructions.'
      },
      null,
      2
    )
  );
}

function printPacket(pipeline, deliveryKit, args) {
  const options = parseOptions(args);
  const packet = renderOutreachPacket({
    pipeline,
    deliveryKit,
    templateId: options.template ?? 'transparency-audit-first-contact',
    prospectName: options.prospect ?? options.name,
    publicProfileUrl: options.profile,
    projectUrl: options.projectUrl
  });
  console.log(packet);
}

function printApprovedPacket(pipeline, deliveryKit, args) {
  const options = parseOptions(args);
  const packet = renderApprovedProspectOutreachPacket({
    pipeline,
    deliveryKit,
    prospectId: options.prospectId ?? options.prospect,
    templateId: options.template ?? 'transparency-audit-first-contact'
  });
  console.log(packet);
}

async function writeApprovedPacket(pipeline, deliveryKit, packetQueue, args) {
  const options = parseOptions(args);
  const queue = appendApprovedProspectOutreachPacket({
    queue: packetQueue,
    pipeline,
    deliveryKit,
    prospectId: options.prospectId ?? options.prospect,
    templateId: options.template ?? 'transparency-audit-first-contact'
  });
  await writeFile(OUTREACH_PACKET_QUEUE_PATH, `${JSON.stringify(queue, null, 2)}\n`);
  const packet = queue.packets.at(-1);
  console.log(JSON.stringify(packet, null, 2));
}

export function renderApprovedProspectOutreachPacket({
  pipeline,
  deliveryKit,
  prospectId,
  templateId = 'transparency-audit-first-contact'
}) {
  const prospect = findApprovedOutreachProspect({ pipeline, prospectId });
  return renderOutreachPacket({
    pipeline,
    deliveryKit,
    templateId,
    prospectName: prospect.id,
    publicProfileUrl: prospect.publicProfileUrl,
    projectUrl: prospect.projectUrl
  });
}

export function appendApprovedProspectOutreachPacket({
  queue,
  pipeline,
  deliveryKit,
  prospectId,
  templateId = 'transparency-audit-first-contact',
  generatedAtUtc = new Date().toISOString()
}) {
  const current = normalizeQueue(queue, pipeline);
  const record = buildApprovedProspectOutreachPacketRecord({
    pipeline,
    deliveryKit,
    prospectId,
    templateId,
    generatedAtUtc
  });
  const duplicate = current.packets.find(
    (packet) =>
      packet.prospectId === record.prospectId &&
      packet.templateId === record.templateId &&
      ['ready-for-manual-send', 'sent'].includes(packet.status)
  );
  if (duplicate) {
    throw new Error(
      `${record.prospectId}: active outreach packet already exists for ${record.templateId} (${duplicate.id}).`
    );
  }
  return {
    ...current,
    updatedAtUtc: generatedAtUtc,
    packets: [...current.packets, record]
  };
}

export function buildApprovedProspectOutreachPacketRecord({
  pipeline,
  deliveryKit,
  prospectId,
  templateId = 'transparency-audit-first-contact',
  generatedAtUtc = new Date().toISOString()
}) {
  const prospect = findApprovedOutreachProspect({ pipeline, prospectId });
  const template = findTemplate({ pipeline, templateId });
  const message = renderOutreachPacket({
    pipeline,
    deliveryKit,
    templateId,
    prospectName: prospect.id,
    publicProfileUrl: prospect.publicProfileUrl,
    projectUrl: prospect.projectUrl
  });
  const dateId = generatedAtUtc.slice(0, 10).replaceAll('-', '');
  return {
    id: `outreach-packet-${dateId}-${prospect.id}-${template.id}`,
    prospectId: prospect.id,
    templateId: template.id,
    offerId: template.offerId,
    status: 'ready-for-manual-send',
    createdAtUtc: generatedAtUtc,
    channel: template.channel,
    outreachApprovalId: prospect.outreachApprovalId,
    destination: {
      publicProfileUrl: prospect.publicProfileUrl,
      projectUrl: prospect.projectUrl
    },
    message,
    sendInstructions:
      'Chairman or authorized human sends this exact factual message manually. Do not add price, return, buyer, liquidity, investment, or market-support claims.',
    recordContactCommand: `node scripts/sats-prospect-response-agent.mjs record-contacted --prospect ${prospect.id} --channel ${template.channel} --evidence "<contact-evidence-url-or-reference>"`,
    boundary:
      'This packet does not approve invoices, payment instructions, paid work, token grants, commitments, or asset movement.'
  };
}

export function renderOutreachPacket({
  pipeline,
  deliveryKit,
  templateId,
  prospectName,
  publicProfileUrl,
  projectUrl
}) {
  const template = findTemplate({ pipeline, templateId });

  const greeting = prospectName ? `Hi ${cleanLine(prospectName)},` : 'Hi,';
  const context = [
    publicProfileUrl ? `Public profile reviewed: ${cleanLine(publicProfileUrl)}` : null,
    projectUrl ? `Project page reviewed: ${cleanLine(projectUrl)}` : null
  ].filter(Boolean);

  return [
    greeting,
    '',
    template.text,
    '',
    ...context,
    context.length > 0 ? '' : null,
    `Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit`,
    `Intake form: ${deliveryKit.intakeUrl}`,
    '',
    'This is draft outreach. Executive Chairman approval is required before contact, invoice, paid work, token grant, or payment instruction.'
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function validateOutreachPacketQueue({ queue, pipeline }) {
  const findings = [];
  const prospects = new Map((pipeline?.prospects ?? []).map((prospect) => [prospect.id, prospect]));
  const ids = new Set();
  for (const packet of queue?.packets ?? []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packet.id ?? '')) {
      findings.push(`${packet.id ?? '<missing-id>'}: packet id must be kebab-case`);
    }
    if (ids.has(packet.id)) findings.push(`${packet.id}: duplicate packet id`);
    ids.add(packet.id);
    if (!['ready-for-manual-send', 'sent', 'superseded'].includes(packet.status)) {
      findings.push(`${packet.id}: unsupported status ${packet.status}`);
    }
    const prospect = prospects.get(packet.prospectId);
    if (!prospect) {
      findings.push(`${packet.id}: prospect does not exist`);
    } else if (packet.status === 'ready-for-manual-send' && prospect.stage !== 'outreach-approved') {
      findings.push(`${packet.id}: ready packet requires outreach-approved prospect`);
    }
    for (const field of ['templateId', 'offerId', 'createdAtUtc', 'channel', 'message', 'boundary']) {
      if (!cleanLine(packet[field])) findings.push(`${packet.id}: missing ${field}`);
    }
    if (!cleanLine(packet.outreachApprovalId)) {
      findings.push(`${packet.id}: outreachApprovalId is required`);
    }
    if (!/record-contacted/i.test(packet.recordContactCommand ?? '')) {
      findings.push(`${packet.id}: recordContactCommand must record contact evidence`);
    }
    if (/\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction)\b/i.test(packet.message ?? '')) {
      findings.push(`${packet.id}: message contains prohibited promotion wording`);
    }
    const paymentInstructionControl =
      /approval is required before .*payment instruction/i.test(packet.message ?? '');
    if (/payment instruction/i.test(packet.message ?? '') && !paymentInstructionControl) {
      findings.push(`${packet.id}: message must not include payment instructions`);
    }
  }
  if (findings.length > 0) {
    throw new Error(`Service outreach packet queue is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function findApprovedOutreachProspect({ pipeline, prospectId }) {
  const prospect = (pipeline.prospects ?? []).find((item) => item.id === prospectId);
  if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);
  if (prospect.stage !== 'outreach-approved') {
    throw new Error(`${prospect.id}: outreach packet requires outreach-approved stage.`);
  }
  if (prospect.chairmanApprovedBeforeOutreach !== true) {
    throw new Error(`${prospect.id}: outreach packet requires chairmanApprovedBeforeOutreach.`);
  }
  if (!cleanLine(prospect.outreachApprovalId)) {
    throw new Error(`${prospect.id}: outreach packet requires outreachApprovalId.`);
  }
  return prospect;
}

function findTemplate({ pipeline, templateId }) {
  const template = pipeline.approvedOutreachTemplates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unknown outreach template: ${templateId}.`);
  return template;
}

function normalizeQueue(queue, pipeline) {
  return {
    project: queue?.project ?? pipeline.project,
    schemaVersion: 1,
    updatedAtUtc: queue?.updatedAtUtc ?? null,
    mode: 'manual-service-outreach-packet-queue',
    boundary:
      'Packets are approved factual outreach drafts only. Sending, contact evidence, invoices, payments, paid work, token grants, and asset movement remain separately gated.',
    packets: queue?.packets ?? []
  };
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

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
