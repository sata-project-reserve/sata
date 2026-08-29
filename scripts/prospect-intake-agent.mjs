import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProspectIntakeDraft } from './lib/prospect-intake-parser.mjs';

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
  default:
    throw new Error(
      `Unknown prospect-intake command: ${command}. Use plan or draft-from-issue-json <path>.`
    );
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: pipeline.project,
        mode: 'prospect-intake-importer',
        issueTemplate: '.github/ISSUE_TEMPLATE/prospect-candidate-intake.yml',
        requiredLeadFields: pipeline.requiredLeadFields,
        leadStages: pipeline.leadStages,
        nextOperatingAction:
          'Export a prospect-candidate issue as JSON, then run draft-from-issue-json to produce an identified prospect draft for chairman review.',
        boundary:
          'The importer drafts records only. It does not contact prospects, approve outreach, send invoices, request payment, or change pipeline state.'
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
