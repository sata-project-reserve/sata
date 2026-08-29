export function buildInvoiceRequestPacket({
  pipeline,
  invoiceQueue,
  prospectIds,
  generatedAtUtc = new Date().toISOString()
}) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  if (!invoiceQueue) throw new Error('Missing invoice queue.');

  const selected = selectProspects({ pipeline, prospectIds });
  const templates = new Map(
    (invoiceQueue.invoices ?? [])
      .filter((invoice) => invoice.status === 'template')
      .map((invoice) => [invoice.offerId, invoice])
  );

  return {
    project: pipeline.project,
    mode: 'chairman-gated-invoice-request-packet',
    generatedAtUtc,
    activeCycleId: pipeline.activeCycleId,
    requestCount: selected.length,
    requests: selected.map((prospect) => {
      const template = templates.get(prospect.recommendedOfferId);
      if (!template) {
        throw new Error(`${prospect.id}: no invoice template for ${prospect.recommendedOfferId}.`);
      }
      return {
        prospectId: prospect.id,
        offerId: prospect.recommendedOfferId,
        usdPrice: template.usdPrice,
        settlementCurrency: template.settlementCurrency,
        paymentAddress: invoiceQueue.paymentPolicy.reserveAddress,
        quoteCommand: `node scripts/sats-invoice-quote-agent.mjs quote-template --offer ${prospect.recommendedOfferId} --customer "${prospect.id}" --btcUsd "<chairman-selected-rate>" --source "<quote-source>"`,
        approvalRequired:
          'Executive Chairman approval is required before the exact-sats invoice or payment instruction is sent.'
      };
    }),
    boundary:
      'This packet prepares quote inputs only. It does not approve an invoice, payment instruction, custody change, paid work, token grant, or asset movement.'
  };
}

export function renderInvoiceRequestPacket({ pipeline, invoiceQueue, prospectIds, generatedAtUtc }) {
  const packet = buildInvoiceRequestPacket({ pipeline, invoiceQueue, prospectIds, generatedAtUtc });
  const lines = [
    '# SATA Invoice Request Packet',
    '',
    `Project: ${packet.project}`,
    `Cycle: ${packet.activeCycleId}`,
    `Generated: ${packet.generatedAtUtc}`,
    `Requests: ${packet.requestCount}`,
    '',
    '## Quote Inputs'
  ];

  for (const request of packet.requests) {
    lines.push(
      '',
      `### ${request.prospectId}`,
      '',
      `- Offer: ${request.offerId}`,
      `- USD price: $${request.usdPrice}`,
      `- Settlement: ${request.settlementCurrency}`,
      `- Payment address: ${request.paymentAddress}`,
      `- Quote command: ${request.quoteCommand}`,
      `- Approval: ${request.approvalRequired}`
    );
  }

  lines.push('', '## Boundary', '', packet.boundary);
  return lines.join('\n');
}

function selectProspects({ pipeline, prospectIds }) {
  const prospects = pipeline.prospects ?? [];
  const ids = normalizeIds(prospectIds);
  const selected =
    ids.size > 0
      ? [...ids].map((id) => {
          const prospect = prospects.find((candidate) => candidate.id === id);
          if (!prospect) throw new Error(`Prospect not found: ${id}`);
          return prospect;
        })
      : prospects.filter((prospect) => prospect.stage === 'invoice-requested').slice(0, 3);

  if (selected.length === 0) {
    throw new Error('No invoice-requested prospects are available for quote preparation.');
  }
  for (const prospect of selected) {
    if (prospect.stage !== 'invoice-requested') {
      throw new Error(`${prospect.id}: invoice request requires invoice-requested stage.`);
    }
    if (prospect.chairmanApprovedBeforeOutreach !== true) {
      throw new Error(`${prospect.id}: invoice request requires prior chairman-approved outreach path.`);
    }
  }
  return selected;
}

function normalizeIds(value) {
  if (value === undefined || value === null || value === '') return new Set();
  const ids = Array.isArray(value) ? value : String(value).split(',');
  return new Set(ids.map((id) => String(id).trim()).filter(Boolean));
}
