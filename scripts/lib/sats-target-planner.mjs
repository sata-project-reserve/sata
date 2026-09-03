const DEFAULT_BTC_USD = 100000;
const SATS_PER_BTC = 100_000_000n;
const PROHIBITED_PATTERN =
  /\b(private key|seed phrase|wash trading|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i;

export function buildSatsTargetPlan({
  status,
  revenuePlan,
  satsLedger,
  btcUsd = DEFAULT_BTC_USD,
  generatedAtUtc = new Date().toISOString()
}) {
  assertInputs({ status, revenuePlan, satsLedger, btcUsd });

  const confirmedSats = BigInt(status.currentReserve.confirmedSats);
  const targetSats = BigInt(status.currentReserve.targetSats);
  const remainingSats = targetSats > confirmedSats ? targetSats - confirmedSats : 0n;
  const nextMilestoneSats = BigInt(satsLedger.target?.nextMilestoneSats ?? confirmedSats);
  const nextMilestoneAdditionalSats =
    nextMilestoneSats > confirmedSats ? nextMilestoneSats - confirmedSats : 0n;
  const reserveAllocationPercent = Number(
    revenuePlan.allocationPolicy?.postReceiptAllocationPercent?.btcReserve ??
      satsLedger.unitEconomics?.defaultPostReceiptAllocationPercent?.btcReserve ??
      70
  );
  const revenueStreams = revenuePlan.revenueStreams ?? [];

  const scenarios = revenueStreams.map((stream) =>
    buildScenario({
      stream,
      remainingSats,
      nextMilestoneAdditionalSats,
      btcUsd,
      reserveAllocationPercent
    })
  );

  return {
    project: status.project,
    mode: 'sats-target-planner',
    generatedAtUtc,
    assumptions: {
      btcUsd: btcUsd.toString(),
      btcUsdSource: 'operator planning assumption, not a live quote',
      reserveAllocationPercent: reserveAllocationPercent.toString(),
      actualSatsRule:
        'Use this for planning only; record actual sats only after confirmed receipt or approved allocation.'
    },
    target: {
      confirmedSats: confirmedSats.toString(),
      nextMilestoneSats: nextMilestoneSats.toString(),
      nextMilestoneAdditionalSats: nextMilestoneAdditionalSats.toString(),
      targetSats: targetSats.toString(),
      remainingSats: remainingSats.toString()
    },
    milestones: [
      buildMilestone({
        id: 'next-1m-sats',
        label: 'Reach 1,000,000 sats reserve',
        additionalSats: nextMilestoneAdditionalSats,
        btcUsd,
        reserveAllocationPercent
      }),
      buildMilestone({
        id: 'full-1b-sats',
        label: 'Reach 1,000,000,000 sats reserve',
        additionalSats: remainingSats,
        btcUsd,
        reserveAllocationPercent
      })
    ],
    scenarios,
    operatingRead:
      'The $50 starter audit can prove the loop, but the full target requires higher-value setup/dashboard work, grants, donations, or chairman-approved asset allocation proposals.',
    nextAction:
      'Use the first five tracked outreach links to seek one paid audit request, then quote exact sats only after a customer asks for an invoice.',
    boundary:
      'This planner does not approve prices, invoices, payments, trading, promotion, token grants, or asset movement.'
  };
}

export function validateSatsTargetPlan(plan) {
  const findings = [];
  if (plan.mode !== 'sats-target-planner') findings.push('mode must be sats-target-planner');
  if (!/^\d+$/.test(plan.target?.remainingSats ?? '')) {
    findings.push('target.remainingSats must be an integer string');
  }
  if (!Array.isArray(plan.milestones) || plan.milestones.length < 2) {
    findings.push('plan must include next and full-target milestones');
  }
  if (!Array.isArray(plan.scenarios) || plan.scenarios.length < 3) {
    findings.push('plan must include every revenue stream scenario');
  }
  if (!/planning only/i.test(plan.assumptions?.actualSatsRule ?? '')) {
    findings.push('assumptions must mark the plan as planning only');
  }
  if (!/does not approve/i.test(plan.boundary ?? '')) {
    findings.push('boundary must preserve approval gates');
  }
  for (const milestone of plan.milestones ?? []) {
    for (const field of ['id', 'label', 'additionalSats', 'netReserveUsd', 'grossRevenueUsd']) {
      if (!cleanLine(milestone[field])) findings.push(`${milestone.id ?? '<missing-id>'}: missing ${field}`);
    }
  }
  for (const scenario of plan.scenarios ?? []) {
    if (!Number.isSafeInteger(scenario.dealsToFullTarget) || scenario.dealsToFullTarget < 0) {
      findings.push(`${scenario.offerId}: dealsToFullTarget must be a non-negative integer`);
    }
    if (!Number.isSafeInteger(scenario.dealsToNextMilestone) || scenario.dealsToNextMilestone < 0) {
      findings.push(`${scenario.offerId}: dealsToNextMilestone must be a non-negative integer`);
    }
  }
  if (PROHIBITED_PATTERN.test(JSON.stringify(plan))) {
    findings.push('plan contains prohibited operating language');
  }
  if (findings.length > 0) {
    throw new Error(`Sats target plan is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

export function renderSatsTargetMarkdown(plan) {
  validateSatsTargetPlan(plan);
  const lines = [
    `# ${plan.project} Sats Target Plan`,
    '',
    `Generated: ${plan.generatedAtUtc}`,
    `BTC/USD assumption: ${plan.assumptions.btcUsd}`,
    `Reserve allocation assumption: ${plan.assumptions.reserveAllocationPercent}%`,
    '',
    '## Boundary',
    plan.boundary,
    '',
    '## Milestones'
  ];

  for (const milestone of plan.milestones) {
    lines.push(
      '',
      `### ${milestone.label}`,
      `Additional sats: ${milestone.additionalSats}`,
      `Net reserve value: $${milestone.netReserveUsd}`,
      `Gross revenue at allocation rate: $${milestone.grossRevenueUsd}`
    );
  }

  lines.push('', '## Revenue Scenarios');
  for (const scenario of plan.scenarios) {
    lines.push(
      '',
      `### ${scenario.label}`,
      `Offer: ${scenario.offerId}`,
      `Price: $${scenario.priceUsd}`,
      `Sats to reserve per closed deal: ${scenario.estimatedReserveSatsPerDeal}`,
      `Deals to next milestone: ${scenario.dealsToNextMilestone}`,
      `Deals to full target: ${scenario.dealsToFullTarget}`
    );
  }

  lines.push('', '## Operating Read', plan.operatingRead, '', '## Next Action', plan.nextAction);
  return `${lines.join('\n')}\n`;
}

function buildScenario({
  stream,
  remainingSats,
  nextMilestoneAdditionalSats,
  btcUsd,
  reserveAllocationPercent
}) {
  const priceUsd = Number(stream.priceUsd);
  const reserveUsdPerDeal = (priceUsd * reserveAllocationPercent) / 100;
  const reserveSatsPerDeal = usdToSats({ usd: reserveUsdPerDeal, btcUsd });
  return {
    offerId: stream.id,
    label: stream.label,
    priceUsd: stream.priceUsd,
    estimatedReserveUsdPerDeal: roundUsd(reserveUsdPerDeal),
    estimatedReserveSatsPerDeal: reserveSatsPerDeal.toString(),
    dealsToNextMilestone: dealsRequired({
      targetSats: nextMilestoneAdditionalSats,
      satsPerDeal: reserveSatsPerDeal
    }),
    dealsToFullTarget: dealsRequired({
      targetSats: remainingSats,
      satsPerDeal: reserveSatsPerDeal
    })
  };
}

function buildMilestone({ id, label, additionalSats, btcUsd, reserveAllocationPercent }) {
  const netReserveUsd = satsToUsd({ sats: additionalSats, btcUsd });
  const grossRevenueUsd =
    reserveAllocationPercent > 0 ? (netReserveUsd * 100) / reserveAllocationPercent : 0;
  return {
    id,
    label,
    additionalSats: additionalSats.toString(),
    netReserveUsd: roundUsd(netReserveUsd),
    grossRevenueUsd: roundUsd(grossRevenueUsd)
  };
}

function assertInputs({ status, revenuePlan, satsLedger, btcUsd }) {
  if (!status || typeof status !== 'object') throw new Error('Missing revenue cycle status.');
  if (!revenuePlan || typeof revenuePlan !== 'object') throw new Error('Missing revenue plan.');
  if (!satsLedger || typeof satsLedger !== 'object') throw new Error('Missing sats ledger.');
  if (!Number.isFinite(Number(btcUsd)) || Number(btcUsd) <= 0) {
    throw new Error('btcUsd must be a positive planning assumption.');
  }
  if (!/^\d+$/.test(status.currentReserve?.confirmedSats ?? '')) {
    throw new Error('status.currentReserve.confirmedSats must be an integer string.');
  }
  if (!/^\d+$/.test(status.currentReserve?.targetSats ?? '')) {
    throw new Error('status.currentReserve.targetSats must be an integer string.');
  }
}

function dealsRequired({ targetSats, satsPerDeal }) {
  if (targetSats <= 0n) return 0;
  if (satsPerDeal <= 0n) return Number.MAX_SAFE_INTEGER;
  return Number((targetSats + satsPerDeal - 1n) / satsPerDeal);
}

function usdToSats({ usd, btcUsd }) {
  return BigInt(Math.floor((usd / btcUsd) * Number(SATS_PER_BTC)));
}

function satsToUsd({ sats, btcUsd }) {
  return (Number(sats) / Number(SATS_PER_BTC)) * btcUsd;
}

function roundUsd(value) {
  return value.toFixed(2);
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
