import { readFile } from 'node:fs/promises';
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
  default:
    throw new Error(`Unknown reserve growth command: ${command}. Use plan.`);
}

function printPlan() {
  const currentSats = BigInt(report.bitcoinReserve?.reserveSats ?? plan.currentReference.reserveSats);
  const targetSats = BigInt(plan.target.targetSats);
  const remainingSats = targetSats > currentSats ? targetSats - currentSats : 0n;
  const progressPpm = targetSats > 0n ? (currentSats * 1_000_000n) / targetSats : 0n;
  const nextMilestone = plan.milestones.find((milestone) => BigInt(milestone.sats) > currentSats);
  const treasuryItems = (queue.items ?? []).filter(
    (item) => item.category === 'treasury-action' && item.status !== 'executed'
  );

  console.log(
    JSON.stringify(
      {
        project: plan.project,
        target: plan.target,
        current: {
          reserveSats: currentSats.toString(),
          reserveBtc: formatSatsAsBtc(currentSats),
          remainingSats: remainingSats.toString(),
          remainingBtc: formatSatsAsBtc(remainingSats),
          progressPpm: progressPpm.toString(),
          progressPercent: `${formatPercentFromPpm(progressPpm)}%`,
          transparencyGeneratedAtUtc: report.generatedAtUtc,
          transparencyStatus: report.status
        },
        nextMilestone: nextMilestone
          ? {
              ...nextMilestone,
              satsNeeded: (BigInt(nextMilestone.sats) - currentSats).toString(),
              btcNeeded: formatSatsAsBtc(BigInt(nextMilestone.sats) - currentSats)
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
