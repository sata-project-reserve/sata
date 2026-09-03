import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildPaidPromotionPlan,
  recordPaidPromotionConversion,
  recordPaidPromotionVerification
} from './lib/paid-promotion-ledger.mjs';

const LEDGER_PATH = join('public', 'paid-promotion-ledger.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const ledger = await readJson(LEDGER_PATH);
  const options = parseOptions(args);

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(buildPaidPromotionPlan({ ledger }), null, 2));
      break;
    case 'record-live':
      await writeLedger(
        recordPaidPromotionVerification({
          ledger,
          campaignId: options.campaign,
          evidence: options.evidence,
          verifiedPostUrl: options.post
        })
      );
      break;
    case 'record-conversion':
      await writeLedger(
        recordPaidPromotionConversion({
          ledger,
          campaignId: options.campaign,
          evidence: options.evidence,
          profileViewLift: options.profileViewLift,
          trackedClicks: options.trackedClicks,
          serviceInquiries: options.serviceInquiries,
          invoiceRequests: options.invoiceRequests,
          confirmedReceiptsSats: options.confirmedReceiptsSats
        })
      );
      break;
    default:
      throw new Error(
        `Unknown paid promotion command: ${command}. Use plan, json, record-live, or record-conversion.`
      );
  }
}

async function writeLedger(ledger) {
  await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(JSON.stringify(buildPaidPromotionPlan({ ledger }), null, 2));
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}`);
    options[key.slice(2)] = collected.join(' ');
  }
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
