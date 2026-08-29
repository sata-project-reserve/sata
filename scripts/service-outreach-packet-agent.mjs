import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const DELIVERY_KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const [pipeline, deliveryKit] = await Promise.all([
    readJson(PIPELINE_PATH),
    readJson(DELIVERY_KIT_PATH)
  ]);

  switch (command) {
    case 'plan':
      printPlan(pipeline, deliveryKit);
      break;
    case 'render':
      printPacket(pipeline, deliveryKit, args);
      break;
    default:
      throw new Error(`Unknown service outreach command: ${command}. Use plan or render.`);
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
          'Render a packet from an approved template for a qualified public-evidence prospect, then request chairman approval before outreach.',
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

export function renderOutreachPacket({
  pipeline,
  deliveryKit,
  templateId,
  prospectName,
  publicProfileUrl,
  projectUrl
}) {
  const template = pipeline.approvedOutreachTemplates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unknown outreach template: ${templateId}.`);

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
