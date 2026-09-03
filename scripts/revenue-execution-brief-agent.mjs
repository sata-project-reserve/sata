import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildRevenueExecutionBrief,
  renderRevenueExecutionMarkdown,
  validateRevenueExecutionBrief
} from './lib/revenue-execution-brief.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const options = parseOptions(args);
  const [status, paidPromotionLedger, outreachPacketQueue] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'paid-promotion-ledger.json')),
    readJson(join('public', 'service-outreach-packet-queue.json'))
  ]);
  const brief = buildRevenueExecutionBrief({
    status,
    paidPromotionLedger,
    outreachPacketQueue,
    maxManualSends: options.maxManualSends ? Number(options.maxManualSends) : 5
  });
  validateRevenueExecutionBrief(brief);

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(brief, null, 2));
      break;
    case 'markdown':
      console.log(renderRevenueExecutionMarkdown(brief));
      break;
    default:
      throw new Error(`Unknown revenue execution brief command: ${command}. Use plan, json, or markdown.`);
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
