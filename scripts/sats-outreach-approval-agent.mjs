import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildOutreachApprovalPacket,
  renderOutreachApprovalPacket
} from './lib/prospect-outreach-approval.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const [, , command = 'plan', ...args] = process.argv;
const pipeline = await readJson(PIPELINE_PATH);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'draft':
    printDraft(args);
    break;
  case 'render':
    printRender(args);
    break;
  default:
    throw new Error(`Unknown sats-outreach-approval command: ${command}. Use plan, draft, or render.`);
}

function printPlan() {
  const eligible = (pipeline.prospects ?? [])
    .filter(
      (prospect) =>
        prospect.stage === 'chairman-review' && prospect.chairmanApprovedBeforeOutreach === true
    )
    .map((prospect) => ({
      id: prospect.id,
      projectUrl: prospect.projectUrl,
      recommendedOfferId: prospect.recommendedOfferId
    }));
  console.log(
    JSON.stringify(
      {
        project: pipeline.project,
        mode: 'chairman-outreach-approval-planner',
        eligible,
        blocked: eligible.length === 0,
        nextAction:
          eligible.length === 0
            ? 'Move approved identified prospects to chairman-review before drafting outreach approval.'
            : 'Draft an outreach approval item for selected chairman-review prospects.',
        boundary:
          'This planner does not approve contact, invoices, payment requests, paid work, token grants, or asset movement.'
      },
      null,
      2
    )
  );
}

function printDraft(args) {
  const options = parseOptions(args);
  const packet = buildOutreachApprovalPacket({
    pipeline,
    prospectIds: options.prospects ?? options.prospect
  });
  console.log(JSON.stringify(packet.approvalItem, null, 2));
}

function printRender(args) {
  const options = parseOptions(args);
  console.log(
    renderOutreachApprovalPacket({
      pipeline,
      prospectIds: options.prospects ?? options.prospect
    })
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
