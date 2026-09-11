import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildProspectIntakeDraft,
  recordProspectIntakeDraft
} from './lib/prospect-intake-parser.mjs';
import { writeRevenueCyclePublicStatus } from './lib/revenue-cycle-public-state.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const [, , command = 'plan', ...args] = process.argv;
const pipeline = await readJson(PIPELINE_PATH);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'draft-from-issue-json':
    await draftFromIssueJson(args[0]);
    break;
  case 'record-from-issue-json':
    await recordFromIssueJson(args);
    break;
  default:
    throw new Error(
      `Unknown prospect-intake command: ${command}. Use plan, draft-from-issue-json <path>, or record-from-issue-json <path> --recordedAtUtc <utc>.`
    );
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: pipeline.project,
        mode: 'prospect-intake-importer',
        issueTemplate: '.github/ISSUE_TEMPLATE/prospect-candidate-intake.yml',
        prospectIntakeUrl: pipeline.prospectIntakeUrl,
        requiredLeadFields: pipeline.requiredLeadFields,
        leadStages: pipeline.leadStages,
        nextOperatingAction:
          'Export a prospect-candidate issue as JSON, then run draft-from-issue-json to review it or record-from-issue-json to append a complete identified prospect for chairman review.',
        boundary:
          'The importer records identified prospects only after public issue evidence is complete. It does not contact prospects, approve outreach, send invoices, request payment, or move assets.'
      },
      null,
      2
    )
  );
}

async function draftFromIssueJson(path) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  const draft = buildProspectIntakeDraft({ issue, pipeline });
  console.log(JSON.stringify(draft, null, 2));
}

async function recordFromIssueJson(args) {
  const [path, ...optionArgs] = args;
  if (!path) throw new Error('Missing issue JSON path.');
  const options = parseOptions(optionArgs);
  const issue = await readJson(path);
  const updated = recordProspectIntakeDraft({
    issue,
    pipeline,
    recordedAtUtc: options.recordedAtUtc
  });
  const candidate = updated.prospects.at(-1);
  await writeFile(PIPELINE_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  await writeRevenueCyclePublicStatus();
  console.log(
    JSON.stringify(
      {
        prospectId: candidate.id,
        stage: candidate.stage,
        status: 'identified',
        nextAction:
          'Submit this identified prospect for Executive Chairman review before any outreach.',
        boundary:
          'Recorded public-evidence prospect only. No contact, invoice, payment request, paid work, token grant, public commitment, or asset movement was approved.'
      },
      null,
      2
    )
  );
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
