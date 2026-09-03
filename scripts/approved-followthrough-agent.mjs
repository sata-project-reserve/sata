import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyApprovedFollowthrough,
  buildApprovedFollowthroughPlan
} from './lib/approved-followthrough.mjs';

const APPROVAL_QUEUE_PATH = join('public', 'executive-approval-queue.json');
const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const DELIVERY_KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');
const PACKET_QUEUE_PATH = join('public', 'service-outreach-packet-queue.json');
const [, , command = 'plan'] = process.argv;

const [approvalQueue, pipeline, deliveryKit, packetQueue] = await Promise.all([
  readJson(APPROVAL_QUEUE_PATH),
  readJson(PIPELINE_PATH),
  readJson(DELIVERY_KIT_PATH),
  readOptionalJson(PACKET_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'write':
    await writeFollowthrough();
    break;
  default:
    throw new Error(`Unknown approved follow-through command: ${command}. Use plan or write.`);
}

function printPlan() {
  const result = buildApprovedFollowthroughPlan({
    approvalQueue,
    pipeline,
    deliveryKit,
    packetQueue
  });
  console.log(JSON.stringify(summary(result), null, 2));
}

async function writeFollowthrough() {
  const result = applyApprovedFollowthrough({
    approvalQueue,
    pipeline,
    deliveryKit,
    packetQueue
  });
  if (!result.changed) {
    console.log(JSON.stringify(summary(result), null, 2));
    return;
  }
  await Promise.all([
    writeFile(APPROVAL_QUEUE_PATH, `${JSON.stringify(result.approvalQueue, null, 2)}\n`),
    writeFile(PIPELINE_PATH, `${JSON.stringify(result.pipeline, null, 2)}\n`),
    writeFile(PACKET_QUEUE_PATH, `${JSON.stringify(result.packetQueue, null, 2)}\n`)
  ]);
  console.log(JSON.stringify(summary(result), null, 2));
}

function summary(result) {
  return {
    project: result.project,
    mode: result.mode,
    generatedAtUtc: result.generatedAtUtc,
    changed: result.changed,
    actions: result.actions,
    boundary: result.boundary
  };
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
