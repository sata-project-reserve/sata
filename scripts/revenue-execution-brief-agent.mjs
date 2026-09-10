import { readFile, writeFile } from 'node:fs/promises';
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
  const [
    status,
    paidPromotionLedger,
    outreachPacketQueue,
    socialQueue,
    prospectPipeline,
    revenuePlan,
    referralPartnerPolicy,
    referralPartnerHandoffQueue,
    referralPartnerHandoffPacket
  ] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'paid-promotion-ledger.json')),
    readJson(join('public', 'service-outreach-packet-queue.json')),
    readJson(join('public', 'social-agent-content-queue.json')),
    readJson(join('public', 'sats-prospect-pipeline.json')),
    readJson(join('public', 'revenue-operating-plan.json')),
    readJson(join('public', 'referral-partner-policy.json')),
    readJson(join('public', 'referral-partner-handoff-queue.json')),
    readOptionalJson(join('public', 'referral-partner-handoff-packet.json'))
  ]);
  const brief = buildRevenueExecutionBrief({
    status,
    paidPromotionLedger,
    outreachPacketQueue,
    socialQueue,
    prospectPipeline,
    revenuePlan,
    referralPartnerPolicy,
    referralPartnerHandoffQueue,
    referralPartnerHandoffPacket,
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
    case 'write':
      await writeExecutionBrief(brief);
      break;
    default:
      throw new Error(
        `Unknown revenue execution brief command: ${command}. Use plan, json, markdown, or write.`
      );
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

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeExecutionBrief(brief) {
  const jsonPath = join('public', 'revenue-execution-brief.json');
  const markdownPath = join('public', 'revenue-execution-brief.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(brief, null, 2)}\n`),
    writeFile(markdownPath, renderRevenueExecutionMarkdown(brief))
  ]);
  console.log(
    JSON.stringify({ wrote: [jsonPath, markdownPath], actions: brief.topActions.length }, null, 2)
  );
}
