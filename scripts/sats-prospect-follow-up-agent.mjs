import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildProspectFollowUpPlan,
  recordProspectFollowUp,
  renderProspectFollowUp
} from './lib/prospect-follow-up.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const [, , command = 'plan', ...args] = process.argv;
const pipeline = await readJson(PIPELINE_PATH);

switch (command) {
  case 'plan':
    console.log(JSON.stringify(buildProspectFollowUpPlan({ pipeline }), null, 2));
    break;
  case 'render':
    renderFollowUp(args);
    break;
  case 'record-sent':
    await recordFollowUp(args);
    break;
  default:
    throw new Error(
      `Unknown sats prospect follow-up command: ${command}. Use plan, render, or record-sent.`
    );
}

function renderFollowUp(args) {
  const options = parseOptions(args);
  console.log(
    renderProspectFollowUp({
      pipeline,
      prospectId: options.prospect,
      generatedAtUtc: options.generatedAtUtc
    })
  );
}

async function recordFollowUp(args) {
  const options = parseOptions(args);
  const updated = recordProspectFollowUp({
    pipeline,
    prospectId: options.prospect,
    followUpEvidence: options.evidence,
    followUpChannel: options.channel
  });
  await writeFile(PIPELINE_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`${options.prospect} follow-up recorded with evidence.`);
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
