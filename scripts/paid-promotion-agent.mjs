import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPaidPromotionPlan } from './lib/paid-promotion-ledger.mjs';

const LEDGER_PATH = join('public', 'paid-promotion-ledger.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const ledger = await readJson(LEDGER_PATH);

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(buildPaidPromotionPlan({ ledger }), null, 2));
      break;
    default:
      throw new Error(`Unknown paid promotion command: ${command}. Use plan or json.`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
