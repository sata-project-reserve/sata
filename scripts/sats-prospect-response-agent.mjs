import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildProspectResponsePlan,
  recordInvoiceRequest,
  recordProspectContact
} from './lib/prospect-response-transition.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const [, , command = 'plan', ...args] = process.argv;
const pipeline = await readJson(PIPELINE_PATH);

switch (command) {
  case 'plan':
    console.log(JSON.stringify(buildProspectResponsePlan({ pipeline }), null, 2));
    break;
  case 'record-contacted':
    await recordContacted(args);
    break;
  case 'record-invoice-request':
    await recordRequestedInvoice(args);
    break;
  default:
    throw new Error(
      `Unknown sats-prospect-response command: ${command}. Use plan, record-contacted, or record-invoice-request.`
    );
}

async function recordContacted(args) {
  const options = parseOptions(args);
  const updated = recordProspectContact({
    pipeline,
    prospectId: options.prospect,
    contactEvidence: options.evidence,
    contactChannel: options.channel
  });
  await writePipeline(updated);
  console.log(`${options.prospect} marked contacted with evidence.`);
}

async function recordRequestedInvoice(args) {
  const options = parseOptions(args);
  const updated = recordInvoiceRequest({
    pipeline,
    prospectId: options.prospect,
    requestEvidence: options.evidence,
    requestedOfferId: options.offer,
    confirmedCustomerRequestedInvoice: /^true$/i.test(options.confirmedCustomerRequestedInvoice ?? '')
  });
  await writePipeline(updated);
  console.log(`${options.prospect} marked invoice-requested with evidence.`);
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writePipeline(updated) {
  await writeFile(PIPELINE_PATH, `${JSON.stringify(updated, null, 2)}\n`);
}
