import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProspectReviewPacket, renderProspectReviewPacket } from './lib/prospect-review-packet.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const [, , command = 'plan'] = process.argv;
const pipeline = await readJson(PIPELINE_PATH);

switch (command) {
  case 'plan':
    console.log(JSON.stringify(buildProspectReviewPacket({ pipeline }), null, 2));
    break;
  case 'render':
    console.log(renderProspectReviewPacket({ pipeline }));
    break;
  default:
    throw new Error(`Unknown sats-prospect-review command: ${command}. Use plan or render.`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
