import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyProspectStageTransition,
  buildProspectStagePlan
} from './lib/prospect-stage-transition.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const APPROVAL_QUEUE_PATH = join('public', 'executive-approval-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const [pipeline, approvalQueue] = await Promise.all([
  readJson(PIPELINE_PATH),
  readJson(APPROVAL_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
    console.log(JSON.stringify(buildProspectStagePlan({ pipeline, approvalQueue }), null, 2));
    break;
  case 'advance':
    await advance(args);
    break;
  default:
    throw new Error(`Unknown sats-prospect-stage command: ${command}. Use plan or advance.`);
}

async function advance(args) {
  const options = parseOptions(args);
  const updated = applyProspectStageTransition({
    pipeline,
    approvalQueue,
    approvalId: options.approvalId ?? 'prospect-review-batch-20260829',
    prospectIds: options.prospects ?? options.prospect,
    targetStage: options.stage ?? 'chairman-review'
  });
  await writeFile(PIPELINE_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(
    `Advanced ${String(options.prospects ?? options.prospect).split(',').length} prospect(s) to chairman-review.`
  );
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error('Options must be provided as --key value pairs.');
    const value = values[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}.`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
