import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PLAN_PATH = join('public', 'reserve-growth-plan.json');
const REPORT_PATH = join('public', 'transparency', 'latest.json');
const QUEUE_PATH = join('public', 'executive-approval-queue.json');

const [, , command = 'plan'] = process.argv;

const [plan, report, queue] = await Promise.all([
  readJson(PLAN_PATH),
  readJson(REPORT_PATH),
  readJson(QUEUE_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'draft-next-tranche':
    await draftNextTranche();
    break;
  default:
    throw new Error(`Unknown reserve growth command: ${command}. Use plan or draft-next-tranche.`);
}

function printPlan() {
  const state = reserveState();
  const treasuryItems = openTreasuryApprovals();

  console.log(
    JSON.stringify(
      {
        project: plan.project,
        target: plan.target,
        current: {
          reserveSats: state.currentSats.toString(),
          reserveBtc: formatSatsAsBtc(state.currentSats),
          remainingSats: state.remainingSats.toString(),
          remainingBtc: formatSatsAsBtc(state.remainingSats),
          progressPpm: state.progressPpm.toString(),
          progressPercent: `${formatPercentFromPpm(state.progressPpm)}%`,
          transparencyGeneratedAtUtc: report.generatedAtUtc,
          transparencyStatus: report.status
        },
        nextMilestone: state.nextMilestone
          ? {
              ...state.nextMilestone,
              satsNeeded: state.nextMilestoneSatsNeeded.toString(),
              btcNeeded: formatSatsAsBtc(state.nextMilestoneSatsNeeded)
            }
          : null,
        allowedRoutes: plan.allowedRoutes.map((route) => route.id),
        prohibitedRoutes: plan.prohibitedRoutes,
        openTreasuryApprovals: treasuryItems.map((item) => ({
          id: item.id,
          status: item.status,
          title: item.title
        })),
        boundary:
          'Agents can plan and verify reserve growth. The Executive Chairman must approve and sign any asset movement.'
      },
      null,
      2
    )
  );
}

async function draftNextTranche() {
  const state = reserveState();
  if (!state.nextMilestone) {
    console.log('The reserve target is already reached. No next tranche proposal was created.');
    return;
  }

  const id = `reserve-tranche-to-${slug(state.nextMilestone.label)}`;
  if ((queue.items ?? []).some((item) => item.id === id)) {
    console.log(`Reserve tranche proposal already exists: ${id}`);
    return;
  }

  queue.items ??= [];
  const createdAtUtc = new Date().toISOString();
  queue.items.push({
    id,
    title: `Add ${state.nextMilestoneSatsNeeded.toString()} sats to reach ${state.nextMilestone.label}`,
    category: 'treasury-action',
    status: 'ready-for-chairman-review',
    createdAtUtc,
    preparedBy: 'reserve-growth-agent',
    summary: `Move the BTC reserve from ${state.currentSats.toString()} sats to ${state.nextMilestone.sats} sats.`,
    rationale:
      'The next reserve milestone is small, easy to verify, and keeps the 1,000,000,000 sats target moving through disclosed treasury actions.',
    proposedAction: `Executive Chairman sends ${state.nextMilestoneSatsNeeded.toString()} sats (${formatSatsAsBtc(
      state.nextMilestoneSatsNeeded
    )} BTC), plus any required Bitcoin network fee, to reserve address ${report.bitcoinReserve.address}. After confirmation, rerun the transparency report and record the transaction id as evidence.`,
    execution: 'manual-chairman-action',
    requiredChairmanApproval: true,
    riskReview: [
      'No agent signs, broadcasts, or custodies the transaction.',
      'Bitcoin network fee must be considered separately from the reserve amount.',
      'The tranche must not be described as price support.',
      'Post-execution evidence must include the Bitcoin transaction id and updated transparency report.'
    ],
    publicDisclosure:
      'Proposed reserve tranche for the long-term 1,000,000,000 sats milestone. No price guarantee, no redemption promise, and no market-support commitment.',
    evidence: [
      {
        type: 'transparency-report',
        url: report.source.latestJson
      },
      {
        type: 'reserve-growth-plan',
        url: 'https://sata-project-reserve.github.io/sata/reserve-growth-plan.json'
      }
    ]
  });
  queue.updatedAtUtc = latestIsoTimestamp(queue.updatedAtUtc, createdAtUtc);
  await writeJson(QUEUE_PATH, queue);
  console.log(`Created chairman-review tranche proposal: ${id}`);
}

function reserveState() {
  const currentSats = BigInt(report.bitcoinReserve?.reserveSats ?? plan.currentReference.reserveSats);
  const targetSats = BigInt(plan.target.targetSats);
  const remainingSats = targetSats > currentSats ? targetSats - currentSats : 0n;
  const progressPpm = targetSats > 0n ? (currentSats * 1_000_000n) / targetSats : 0n;
  const nextMilestone = plan.milestones.find((milestone) => BigInt(milestone.sats) > currentSats);
  const nextMilestoneSatsNeeded = nextMilestone ? BigInt(nextMilestone.sats) - currentSats : 0n;
  return { currentSats, targetSats, remainingSats, progressPpm, nextMilestone, nextMilestoneSatsNeeded };
}

function openTreasuryApprovals() {
  return (queue.items ?? []).filter(
    (item) =>
      item.category === 'treasury-action' &&
      !['executed', 'rejected', 'superseded'].includes(item.status)
  );
}

function formatSatsAsBtc(sats) {
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function formatPercentFromPpm(ppm) {
  const hundredths = ppm / 100n;
  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function latestIsoTimestamp(left, right) {
  const leftTime = Date.parse(left ?? '');
  const rightTime = Date.parse(right ?? '');
  if (Number.isNaN(leftTime)) return right;
  if (Number.isNaN(rightTime)) return left;
  return leftTime >= rightTime ? left : right;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}
