export function buildRevenueCycleStatus({
  report,
  revenuePlan,
  ledger,
  invoiceQueue,
  prospectPipeline,
  outreachPacketQueue = { packets: [] },
  approvalQueue = { items: [] },
  socialQueue,
  env = process.env
}) {
  assertInputs({
    report,
    revenuePlan,
    ledger,
    invoiceQueue,
    prospectPipeline,
    outreachPacketQueue,
    approvalQueue,
    socialQueue
  });

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
  const readyOutreachPackets = (outreachPacketQueue.packets ?? []).filter(
    (packet) => packet.status === 'ready-for-manual-send'
  );
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

  const actionQueue = buildActionQueue({
    prospects,
    approvedInvoices,
    receiptsAwaitingAllocation,
    readyOutreachPackets,
    approvedPosts,
    livePostingEnabled,
    prospectPipeline,
    approvalQueue
  });

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
      identifiedProspects: prospects.filter((prospect) => prospect.stage === 'identified').length,
      chairmanReviewProspects: prospects.filter((prospect) => prospect.stage === 'chairman-review').length,
      outreachApprovedProspects: prospects.filter((prospect) => prospect.stage === 'outreach-approved').length,
      approvedInvoices: approvedInvoices.length,
      confirmedReceipts: confirmedReceipts.length,
      receiptsAwaitingAllocation: receiptsAwaitingAllocation.length,
      recordedAllocations: allocations.length,
      readyOutreachPackets: readyOutreachPackets.length
    },
    social: {
      queueMode: socialQueue.mode,
      approvedPosts: approvedPosts.length,
      readyForReviewPosts: readyPosts.length,
      livePostingEnabled
    },
    blockers,
    actionQueue,
    nextAction: actionQueue[0]?.title ?? prospectPipeline.nextOperatingAction,
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
  if (!Array.isArray(status.actionQueue) || status.actionQueue.length === 0) {
    findings.push('actionQueue must include at least one executable operating item');
  }
  for (const item of status.actionQueue ?? []) {
    if (!item.id || !item.type || !item.title) {
      findings.push('actionQueue items require id, type, and title');
    }
    if (!Number.isInteger(item.priority) || item.priority < 1) {
      findings.push(`${item.id ?? '<missing-id>'}: actionQueue priority must be a positive integer`);
    }
    if (/pump|guarantee|wash|fake engagement|private key|seed phrase/i.test(item.title ?? '')) {
      findings.push(`${item.id ?? '<missing-id>'}: actionQueue title contains prohibited wording`);
    }
    if (!/Chairman|authorized human|agent|customer/i.test(item.requiredActor ?? '')) {
      findings.push(`${item.id ?? '<missing-id>'}: actionQueue requiredActor must name the responsible boundary`);
    }
  }
  if (!/Executive Chairman approves/i.test(status.boundary ?? '')) {
    findings.push('boundary must preserve chairman approval authority');
  }
  if (findings.length > 0) {
    throw new Error(`Revenue cycle status is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function buildActionQueue({
  prospects,
  approvedInvoices,
  receiptsAwaitingAllocation,
  readyOutreachPackets,
  approvedPosts,
  livePostingEnabled,
  prospectPipeline,
  approvalQueue
}) {
  const actions = [];
  const approvalItems = approvalQueue.items ?? [];
  const pendingChairmanApprovals = approvalItems.filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  const approvedOutreachApprovals = approvalItems.filter(
    (item) => item.status === 'approved-by-chairman' && item.id?.startsWith('outreach-approval-')
  );
  const pendingOutreachProspectIds = new Set(
    pendingChairmanApprovals
      .filter((item) => item.id?.startsWith('outreach-approval-'))
      .flatMap((item) => outreachProspectIdsFromTitle(item.title))
  );

  for (const receipt of receiptsAwaitingAllocation) {
    actions.push({
      id: `allocate-${receipt.id}`,
      priority: actions.length + 1,
      type: 'receipt-allocation-proposal',
      title: `Render receipt allocation proposal for ${receipt.id}.`,
      requiredActor: 'agent prepares proposal; Executive Chairman approves allocation',
      command: `node scripts/sats-receipt-allocation-agent.mjs render --receipt ${receipt.id}`,
      evidenceRequired: 'Confirmed direct-reserve BTC receipt and chairman allocation approval.',
      boundary: 'No reserve accounting change is final until the Executive Chairman approves it.'
    });
  }

  for (const invoice of approvedInvoices) {
    actions.push({
      id: `payment-packet-${invoice.id}`,
      priority: actions.length + 1,
      type: 'approved-invoice-payment-packet',
      title: `Render approved customer payment packet for ${invoice.id} before the quote expires.`,
      requiredActor: 'agent prepares packet; authorized human sends it',
      command: `node scripts/sats-invoice-payment-packet-agent.mjs render --invoice ${invoice.id}`,
      evidenceRequired: 'Chairman-approved exact-sats invoice record.',
      boundary: 'Payment instructions must route only to the published reserve address.'
    });
  }

  for (const packet of readyOutreachPackets) {
    actions.push({
      id: `send-${packet.id}`,
      priority: actions.length + 1,
      type: 'manual-outreach-send',
      title: `Send ready manual outreach packet ${packet.id} and record contact evidence.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: packet.recordContactCommand,
      evidenceRequired: 'Contact URL, message permalink, email record, or other durable send evidence.',
      boundary: 'Send the approved factual copy only; no price, return, buyer, liquidity, investment, or market-support claims.'
    });
  }

  for (const item of pendingChairmanApprovals) {
    actions.push({
      id: `approve-${item.id}`,
      priority: actions.length + 1,
      type: 'chairman-approval-needed',
      title: `Chairman decision needed for ${item.id}: ${item.title}.`,
      requiredActor: 'Executive Chairman',
      command: approvalCommand(item),
      evidenceRequired: `${item.evidence?.length ?? 0} evidence record(s) in executive approval queue.`,
      boundary:
        'Approval records a chairman decision only; it does not contact prospects, approve invoices, move assets, or make public commitments.'
    });
  }

  for (const item of approvedOutreachApprovals) {
    const prospectIds = outreachProspectIdsFromTitle(item.title).filter((prospectId) => {
      const prospect = prospects.find((candidate) => candidate.id === prospectId);
      return prospect?.stage === 'chairman-review';
    });
    if (prospectIds.length === 0) continue;
    actions.push({
      id: `advance-${item.id}`,
      priority: actions.length + 1,
      type: 'advance-approved-outreach',
      title: `Advance chairman-approved outreach prospects for ${item.id}.`,
      requiredActor: 'agent',
      command: `node scripts/sats-outreach-approval-agent.mjs advance --approvalId ${item.id} --prospects ${prospectIds.join(',')}`,
      evidenceRequired: 'Approved outreach approval item and matching chairman-review prospects.',
      boundary: 'Advancing prospect state does not send outreach.'
    });
  }

  const invoiceRequested = prospects.find((prospect) => prospect.stage === 'invoice-requested');
  if (invoiceRequested) {
    actions.push({
      id: `quote-${invoiceRequested.id}`,
      priority: actions.length + 1,
      type: 'invoice-quote-inputs',
      title: `Prepare exact-sats invoice quote inputs for invoice-requested prospect ${invoiceRequested.id}.`,
      requiredActor: 'agent prepares quote inputs; Executive Chairman approves invoice',
      command: `node scripts/sats-invoice-quote-agent.mjs plan --prospect ${invoiceRequested.id}`,
      evidenceRequired: 'Customer request for invoice and public reserve address match.',
      boundary: 'No invoice or payment instruction may be sent before chairman approval.'
    });
  }

  const contacted = prospects.find((prospect) => prospect.stage === 'contacted');
  if (contacted) {
    actions.push({
      id: `wait-invoice-request-${contacted.id}`,
      priority: actions.length + 1,
      type: 'await-customer-invoice-request',
      title: `Wait for ${contacted.id} to request an invoice before quote preparation.`,
      requiredActor: 'customer',
      command: 'npm run ops:prospect-response-plan',
      evidenceRequired: 'Customer reply requesting an invoice.',
      boundary: 'Do not push payment instructions without a customer invoice request.'
    });
  }

  const outreachApproved = prospects.find((prospect) => prospect.stage === 'outreach-approved');
  const queuedProspectIds = new Set(readyOutreachPackets.map((packet) => packet.prospectId));
  if (outreachApproved && !queuedProspectIds.has(outreachApproved.id)) {
    actions.push({
      id: `render-outreach-${outreachApproved.id}`,
      priority: actions.length + 1,
      type: 'render-approved-outreach-packet',
      title: `Render manual outreach packet for approved prospect ${outreachApproved.id}.`,
      requiredActor: 'agent',
      command: `node scripts/service-outreach-packet-agent.mjs write-approved --prospect ${outreachApproved.id}`,
      evidenceRequired: 'Outreach-approved prospect record.',
      boundary: 'Rendering a packet does not send the outreach.'
    });
  }

  const nextChairmanReviewProspects = prospects
    .filter(
      (prospect) => prospect.stage === 'chairman-review' && !pendingOutreachProspectIds.has(prospect.id)
    )
    .slice(0, Number(prospectPipeline.dailyCadence?.outreachLimit ?? 3));
  if (nextChairmanReviewProspects.length > 0) {
    const prospectIds = nextChairmanReviewProspects.map((prospect) => prospect.id).join(',');
    actions.push({
      id: `draft-outreach-approval-${nextChairmanReviewProspects.map((prospect) => prospect.id).join('-')}`,
      priority: actions.length + 1,
      type: 'draft-outreach-approval',
      title: `Draft contact-only outreach approval packet for chairman-reviewed prospects ${nextChairmanReviewProspects.map((prospect) => prospect.id).join(', ')}.`,
      requiredActor: 'agent prepares approval item; Executive Chairman approves outreach',
      command: `node scripts/sats-outreach-approval-agent.mjs draft --prospects ${prospectIds}`,
      evidenceRequired: 'Chairman-reviewed prospect record.',
      boundary: 'Draft approval does not authorize contact until the Executive Chairman approves it.'
    });
  }

  const identified = prospects.find((prospect) => prospect.stage === 'identified');
  if (identified) {
    actions.push({
      id: 'render-next-prospect-review',
      priority: actions.length + 1,
      type: 'prospect-review-packet',
      title: 'Render prospect review packet for the next identified candidates before any outreach.',
      requiredActor: 'agent prepares review packet; Executive Chairman approves prospect review',
      command: 'npm run ops:prospect-review-plan',
      evidenceRequired: 'Evidence-backed prospect candidates.',
      boundary: 'Prospects cannot move beyond identified without chairman review.'
    });
  }

  if (prospects.length === 0) {
    actions.push({
      id: 'identify-evidence-backed-prospects',
      priority: actions.length + 1,
      type: 'prospect-discovery',
      title: prospectPipeline.nextOperatingAction,
      requiredActor: 'agent',
      command: 'npm run ops:prospect-candidate-plan',
      evidenceRequired: 'Public source evidence for each prospect.',
      boundary: 'Only factual, evidence-backed prospects may enter the pipeline.'
    });
  }

  if (approvedPosts.length > 0 && !livePostingEnabled) {
    actions.push({
      id: `publish-social-${approvedPosts[0].id}`,
      priority: actions.length + 1,
      type: 'manual-social-publish',
      title: `Manually publish approved post ${approvedPosts[0].id}, or enable approved-only X credentials after chairman approval.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: 'npm run social:agent:dry-run',
      evidenceRequired: 'Published post URL or approved-only posting credentials.',
      boundary: 'Only chairman-approved factual posts may be published.'
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'continue-prospect-qualification',
      priority: 1,
      type: 'prospect-qualification',
      title: 'Continue qualifying evidence-backed prospects and prepare chairman-review records.',
      requiredActor: 'agent',
      command: 'npm run ops:prospect-plan',
      evidenceRequired: 'Public source evidence for each prospect.',
      boundary: 'No outreach, invoice, paid work, or asset movement without the required approval gate.'
    });
  }

  return actions.map((action, index) => ({ ...action, priority: index + 1 }));
}

function approvalCommand(item) {
  return `npm run ops:approve -- ${item.id} --confirm-chairman-approval "I am Executive Chairman and approve ${item.id}"`;
}

function outreachProspectIdsFromTitle(title) {
  const match = /^Approve factual outreach to (?<ids>.+)$/.exec(title ?? '');
  return (match?.groups?.ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function assertInputs({
  report,
  revenuePlan,
  ledger,
  invoiceQueue,
  prospectPipeline,
  outreachPacketQueue,
  approvalQueue,
  socialQueue
}) {
  const required = {
    report,
    revenuePlan,
    ledger,
    invoiceQueue,
    prospectPipeline,
    outreachPacketQueue,
    approvalQueue,
    socialQueue
  };
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
