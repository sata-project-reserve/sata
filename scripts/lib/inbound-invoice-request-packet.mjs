const INVOICE_REQUEST_STATUS = 'invoice-requested-needs-chairman-review';

export function buildInboundInvoiceRequestPacket({
  inboundQueue,
  invoiceQueue,
  leadIds,
  generatedAtUtc = new Date().toISOString()
}) {
  if (!inboundQueue) throw new Error('Missing inbound lead queue.');
  if (!invoiceQueue) throw new Error('Missing invoice queue.');

  const selected = selectLeads({ inboundQueue, leadIds });
  const templates = new Map(
    (invoiceQueue.invoices ?? [])
      .filter((invoice) => invoice.status === 'template')
      .map((invoice) => [invoice.offerId, invoice])
  );

  return {
    project: inboundQueue.project,
    mode: 'chairman-gated-inbound-invoice-request-packet',
    generatedAtUtc,
    requestCount: selected.length,
    requests: selected.map((lead) => {
      const template = templates.get(lead.requestedOfferId);
      if (!template) {
        throw new Error(`${lead.id}: no invoice template for ${lead.requestedOfferId}.`);
      }
      return {
        leadId: lead.id,
        sourceType: lead.sourceType,
        sourceId: lead.sourceId,
        contactHandle: lead.contactHandle,
        publicProfileUrl: lead.publicProfileUrl,
        projectUrl: lead.projectUrl,
        evidence: lead.evidence,
        offerId: lead.requestedOfferId,
        usdPrice: template.usdPrice,
        settlementCurrency: template.settlementCurrency,
        paymentAddress: invoiceQueue.paymentPolicy.reserveAddress,
        quoteCommand: `node scripts/sats-invoice-quote-agent.mjs quote-template --offer ${lead.requestedOfferId} --customer "${lead.id}" --btcUsd "<chairman-selected-rate>" --source "<quote-source>"`,
        approvalRequired:
          'Executive Chairman approval is required before the exact-sats invoice or payment instruction is sent.'
      };
    }),
    boundary:
      'This packet prepares quote inputs only. It does not approve an invoice, payment instruction, paid work, token grant, custody change, public commitment, or asset movement.'
  };
}

export function renderInboundInvoiceRequestPacket({
  inboundQueue,
  invoiceQueue,
  leadIds,
  generatedAtUtc
}) {
  const packet = buildInboundInvoiceRequestPacket({
    inboundQueue,
    invoiceQueue,
    leadIds,
    generatedAtUtc
  });
  const lines = [
    '# SATA Inbound Invoice Request Packet',
    '',
    `Project: ${packet.project}`,
    `Generated: ${packet.generatedAtUtc}`,
    `Requests: ${packet.requestCount}`,
    '',
    '## Quote Inputs'
  ];

  for (const request of packet.requests) {
    lines.push(
      '',
      `### ${request.leadId}`,
      '',
      `- Source: ${request.sourceType} / ${request.sourceId}`,
      `- Contact: ${request.contactHandle}`,
      `- Profile: ${request.publicProfileUrl}`,
      `- Project: ${request.projectUrl}`,
      `- Evidence: ${request.evidence}`,
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

function selectLeads({ inboundQueue, leadIds }) {
  const leads = inboundQueue.leads ?? [];
  const ids = normalizeIds(leadIds);
  const selected =
    ids.size > 0
      ? [...ids].map((id) => {
          const lead = leads.find((candidate) => candidate.id === id);
          if (!lead) throw new Error(`Inbound lead not found: ${id}`);
          return lead;
        })
      : leads.filter((lead) => lead.status === INVOICE_REQUEST_STATUS).slice(0, 3);

  if (selected.length === 0) {
    throw new Error('No inbound invoice-request leads are available for quote preparation.');
  }
  for (const lead of selected) {
    if (lead.status !== INVOICE_REQUEST_STATUS) {
      throw new Error(`${lead.id}: inbound invoice request requires ${INVOICE_REQUEST_STATUS}.`);
    }
    if (lead.customerAskedForInvoice !== true) {
      throw new Error(`${lead.id}: customerAskedForInvoice must be true.`);
    }
  }
  return selected;
}

function normalizeIds(value) {
  if (value === undefined || value === null || value === '') return new Set();
  const ids = Array.isArray(value) ? value : String(value).split(',');
  return new Set(ids.map((id) => String(id).trim()).filter(Boolean));
}
