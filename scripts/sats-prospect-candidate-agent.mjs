import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProspectCandidate } from './lib/sats-prospect-candidate.mjs';

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
  default:
    throw new Error(`Unknown sats prospect candidate command: ${command}. Use plan or draft.`);
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: pipeline.project,
        mode: 'prospect-candidate-drafts',
        primaryOfferId: pipeline.primaryOfferId,
        requiredFields: pipeline.requiredLeadFields,
        example:
          'node scripts/sats-prospect-candidate-agent.mjs draft --id example-team --publicProfileUrl https://x.com/example --projectUrl https://example.com --observedClaim "Publishes liquidity claims without a clear lock proof" --evidence https://example.com',
        nextAction:
          'Draft identified prospects from public evidence, then batch them for chairman review before any outreach.',
        boundary:
          'This agent creates draft records only. It does not contact prospects, approve outreach, send invoices, or request payment.'
      },
      null,
      2
    )
  );
}

function printDraft(args) {
  const options = parseOptions(args);
  const candidate = buildProspectCandidate({
    pipeline,
    id: options.id,
    source: options.source,
    publicProfileUrl: options.publicProfileUrl,
    projectUrl: options.projectUrl,
    observedClaim: options.observedClaim,
    recommendedOfferId: options.offer ?? options.recommendedOfferId,
    evidence: options.evidence,
    notes: options.notes
  });
  console.log(JSON.stringify(candidate, null, 2));
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
    const optionName = key.slice(2);
    const value = collected.join(' ');
    if (optionName === 'evidence') {
      options.evidence = [...(options.evidence ?? []), value];
    } else {
      options[optionName] = value;
    }
  }
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
