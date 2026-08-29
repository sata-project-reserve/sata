export function buildRevenueCycleStatus({
  report,
  revenuePlan,
  ledger,
  invoiceQueue,
  prospectPipeline,
  socialQueue,
  env = process.env
}) {
  assertInputs({ report, revenuePlan, ledger, invoiceQueue, prospectPipeline, socialQueue });

  const targetSats = BigInt(ledger.target?.targetSats ?? revenuePlan.nextCycle?.targetSats ?? '1000000000');
  const currentReserveSats = BigInt(report.bitcoinReserve?.confirmedReserveSats ?? ledger.target?.currentReserveSats ?? '0');
  const remainingSats = targetSats > currentReserveSats ? targetSats - currentReserveSats : 0n;
  const prospects = prospectPipeline.prospects ?? [];
  const invoices = invoiceQueue.invoices ?? [];
  const receipts = ledger.receipts ?? [];
  const allocations = ledger.allocations ?? [];
  const approvedInvoices = invoices.filter((invoice) => invoice.status === 'approved-by-chairman');
  const confirmedReceipts = receipts.filter((receipt) => receipt.status === 'confirmed');
  const allocationReceiptIds = new Set(allocations.map((allocation) => allocation.receiptId));
  const receiptsAwaitingAllocation = confirmedReceipts.filter((receipt) => !allocationReceiptIds.has(receipt.id));
  const approvedPosts = (socialQueue.posts ?? []).filter((post) => post.status === 'approved');
  const readyPosts = (socialQueue.posts ?? []).filter((post) => post.status === 'ready-for-review');
  const livePostingEnabled = env.SATA_X_AGENT_ENABLE_POSTING === 'true' && Boolean(env.X_ACCESS_TOKEN);

  const blockers = [];
  if (prospects.length === 0) blockers.push('No evidence-backed prospects are recorded.');
  if (approvedInvoices.length === 0) blockers.push('No chairman-approved exact-sats invoice is ready to send.');
  if (confirmedReceipts.length === 0) blockers.push('No confirmed direct-reserve BTC receipt is recorded.');
  if (approvedPosts.length > 0 && !livePostingEnabled) {
    blockers.push('Approved social content exists, but live X posting credentials are not enabled in this runtime.');
  }

  return {
    project: revenuePlan.project,
    cycleId: revenuePlan.nextCycle?.id,
    objective: revenuePlan.objective,
    currentReserve: {
      confirmedSats: currentReserveSats.toString(),
      confirmedBtc: formatSatsAsBtc(currentReserveSats),
      targetSats: targetSats.toString(),
      remainingSats: remainingSats.toString(),
      remainingBtc: formatSatsAsBtc(remainingSats),
      latestReportGeneratedAtUtc: report.generatedAtUtc
    },
    funnel: {
      prospects: prospects.length,
      chairmanReviewProspects: prospects.filter((prospect) => prospect.stage === 'chairman-review').length,
      outreachApprovedProspects: prospects.filter((prospect) => prospect.stage === 'outreach-approved').length,
      approvedInvoices: approvedInvoices.length,
      confirmedReceipts: confirmedReceipts.length,
      receiptsAwaitingAllocation: receiptsAwaitingAllocation.length,
      recordedAllocations: allocations.length
    },
    social: {
      queueMode: socialQueue.mode,
      approvedPosts: approvedPosts.length,
      readyForReviewPosts: readyPosts.length,
      livePostingEnabled
    },
    blockers,
    nextAction: chooseNextAction({
      prospects,
      approvedInvoices,
      receiptsAwaitingAllocation,
      approvedPosts,
      livePostingEnabled,
      prospectPipeline
    }),
    boundary:
      'Agents may prepare records, packets, and proposals. The Executive Chairman approves outreach, invoices, transactions, allocations, paid promotion, token grants, and any asset movement.'
  };
}

export function validateRevenueCycleStatus(status) {
  const findings = [];
  if (!status.project) findings.push('status.project is required');
  if (!/1,000,000,000 sats|reserve/i.test(status.objective ?? '')) {
    findings.push('status.objective must preserve the reserve-growth objective');
  }
  if (!/^\d+$/.test(status.currentReserve?.confirmedSats ?? '')) {
    findings.push('currentReserve.confirmedSats must be an integer string');
  }
  if (!/^\d+$/.test(status.currentReserve?.targetSats ?? '')) {
    findings.push('currentReserve.targetSats must be an integer string');
  }
  if (!status.nextAction || /pump|guarantee|wash|fake engagement|private key|seed phrase/i.test(status.nextAction)) {
    findings.push('nextAction must be present and avoid prohibited routes');
  }
  if (!/Executive Chairman approves/i.test(status.boundary ?? '')) {
    findings.push('boundary must preserve chairman approval authority');
  }
  if (findings.length > 0) {
    throw new Error(`Revenue cycle status is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function chooseNextAction({
  prospects,
  approvedInvoices,
  receiptsAwaitingAllocation,
  approvedPosts,
  livePostingEnabled,
  prospectPipeline
}) {
  if (receiptsAwaitingAllocation.length > 0) {
    return `Render receipt allocation proposal for ${receiptsAwaitingAllocation[0].id}.`;
  }
  if (approvedInvoices.length > 0) {
    return `Render approved customer payment packet for ${approvedInvoices[0].id} before the quote expires.`;
  }
  const outreachApproved = prospects.find((prospect) => prospect.stage === 'outreach-approved');
  if (outreachApproved) {
    return `Render manual outreach packet for approved prospect ${outreachApproved.id}.`;
  }
  const chairmanReview = prospects.find((prospect) => prospect.stage === 'chairman-review');
  if (chairmanReview) {
    return `Prepare chairman review for prospect ${chairmanReview.id}.`;
  }
  if (prospects.length === 0) {
    return prospectPipeline.nextOperatingAction;
  }
  if (approvedPosts.length > 0 && !livePostingEnabled) {
    return `Manually publish approved post ${approvedPosts[0].id}, or enable approved-only X credentials after chairman approval.`;
  }
  return 'Continue qualifying evidence-backed prospects and prepare chairman-review records.';
}

function assertInputs({ report, revenuePlan, ledger, invoiceQueue, prospectPipeline, socialQueue }) {
  const required = { report, revenuePlan, ledger, invoiceQueue, prospectPipeline, socialQueue };
  for (const [label, value] of Object.entries(required)) {
    if (!value || typeof value !== 'object') throw new Error(`Missing ${label}.`);
  }
  if (invoiceQueue.paymentPolicy?.reserveAddress !== report.bitcoinReserve?.address) {
    throw new Error('Invoice reserve address must match the latest transparency report.');
  }
  if (prospectPipeline.target?.reserveTargetSats !== ledger.target?.targetSats) {
    throw new Error('Prospect pipeline target must match the sats-generation ledger target.');
  }
}

function formatSatsAsBtc(sats) {
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
