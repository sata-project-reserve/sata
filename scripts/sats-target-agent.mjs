import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildSatsTargetPlan,
  renderSatsTargetMarkdown,
  validateSatsTargetPlan
} from './lib/sats-target-planner.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const options = parseOptions(args);
  const [status, revenuePlan, satsLedger] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'revenue-operating-plan.json')),
    readJson(join('public', 'sats-generation-ledger.json'))
  ]);
  const plan = buildSatsTargetPlan({
    status,
    revenuePlan,
    satsLedger,
    btcUsd: options.btcUsd ? Number(options.btcUsd) : undefined
  });
  validateSatsTargetPlan(plan);

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(plan, null, 2));
      break;
    case 'markdown':
      console.log(renderSatsTargetMarkdown(plan));
      break;
    default:
      throw new Error(`Unknown sats target command: ${command}. Use plan, json, or markdown.`);
  }
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    if (!values[index + 1] || values[index + 1].startsWith('--')) {
      throw new Error(`Missing value for ${key}`);
    }
    options[key.slice(2)] = values[index + 1];
    index += 1;
  }
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
