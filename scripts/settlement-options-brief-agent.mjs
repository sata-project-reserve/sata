import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const [status, revenuePlan, invoiceQueue, report] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'revenue-operating-plan.json')),
    readJson(join('public', 'sats-invoice-queue.json')),
    readJson(join('public', 'transparency', 'latest.json'))
  ]);
  const brief = buildSettlementOptionsBrief({ status, revenuePlan, invoiceQueue, report });

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(brief, null, 2));
      break;
    case 'markdown':
      console.log(renderSettlementOptionsMarkdown(brief));
      break;
    case 'write':
      await writeSettlementOptionsBrief(brief);
      break;
    default:
      throw new Error(
        `Unknown settlement options command: ${command}. Use plan, json, markdown, or write.`
      );
  }
}

export function buildSettlementOptionsBrief({
  status,
  revenuePlan,
  invoiceQueue,
  report,
  generatedAtUtc = new Date().toISOString()
}) {
  if (!status) throw new Error('Missing revenue cycle status.');
  if (!revenuePlan) throw new Error('Missing revenue operating plan.');
  if (!invoiceQueue) throw new Error('Missing sats invoice queue.');
  if (!report) throw new Error('Missing transparency report.');

  const revenueStreams = revenuePlan.revenueStreams ?? [];
  const templates = (invoiceQueue.invoices ?? []).filter((invoice) => invoice.status === 'template');
  const templateOfferIds = new Set(templates.map((invoice) => invoice.offerId));
  const currencyPreference = revenuePlan.allocationPolicy?.currencyPreference ?? [];
  const btcTemplateCoverage = revenueStreams.map((stream) => ({
    offerId: stream.id,
    label: stream.label,
    priceUsd: stream.priceUsd,
    hasTemplate: templateOfferIds.has(stream.id),
    quoteCommand: [
      'node scripts/sats-invoice-quote-agent.mjs write-draft',
      `--offer ${stream.id}`,
      '--customer "<customer-or-project-id>"',
      '--btcUsd "<manual-btc-usd-rate>"',
      '--source "<rate-source-url-or-note>"',
      '--createdAtUtc "<created-at-utc>"',
      '--ttlMinutes 30',
      '--evidence "<customer-invoice-request-evidence>"'
    ].join(' ')
  }));

  return {
    project: status.project,
    mode: 'chairman-gated-settlement-options-brief',
    generatedAtUtc,
    reserve: status.currentReserve,
    currencyPreference,
    directReservePath: {
      settlementCurrency: 'BTC',
      status: templates.length === revenueStreams.length ? 'implemented-for-all-service-templates' : 'partial',
      quoteRule: invoiceQueue.paymentPolicy?.quoteRule,
      custodyRule: invoiceQueue.paymentPolicy?.custodyRule,
      paymentAddressPolicy:
        'Do not send a payment address or amount from this brief. Render a customer payment packet only after a chairman-approved exact-sats invoice.',
      reserveAddressSource: 'public/transparency/latest.json bitcoinReserve.address',
      supportedOffers: btcTemplateCoverage
    },
    alternativeSettlementPaths: currencyPreference
      .filter((currency) => currency !== 'BTC')
      .map((currency) => ({
        settlementCurrency: currency,
        status: 'planning-only-not-invoice-enabled',
        customerReply:
          `${currency} can be considered only after a customer asks for an invoice and there is separate Executive Chairman approval for a recorded settlement path. BTC direct-reserve invoices are the current implemented path.`,
        requiredBeforeUse: [
          'customer invoice-request evidence',
          'chairman-approved settlement decision',
          'recorded receiving address or escrow terms',
          'conversion and allocation proposal before any reserve progress is counted',
          'post-receipt evidence and updated transparency report'
        ],
        stopRule:
          'Do not send USDC, SOL, wallet, escrow, or conversion instructions from this brief.'
      })),
    customerReplyTemplates: {
      btcPreferred:
        'BTC direct to the published reserve is the current implemented invoice path. If you want to proceed, send the project link, selected service, and confirmation that you want an invoice. Exact sats, expiration, and payment instructions are sent only after Executive Chairman approval.',
      alternativeRequested:
        'USDC on Solana or SOL can be reviewed, but it is not the current direct reserve invoice path. Send the selected service, project link, and requested settlement currency. Any address, quote, conversion, allocation, or payment instruction requires separate Executive Chairman approval.'
    },
    stopRules: [
      'No payment address, amount, or QR code from this settlement brief.',
      'No invoice without customer request evidence.',
      'No USDC, SOL, wallet, escrow, conversion, or allocation instruction without separate chairman approval.',
      'No reserve progress counted until direct BTC receipt or approved allocation evidence exists.',
      'No private keys, seed phrases, custody handoff, price guarantees, redemption promises, or market-support commitments.'
    ],
    nextAction:
      status.funnel?.inboundInvoiceRequestsNeedingChairmanReview > 0
        ? 'Render the inbound invoice request packet before quoting settlement.'
        : 'Use the BTC-preferred reply when a customer asks how to pay, and record any explicit invoice request before quoting.',
    boundary:
      'This brief explains settlement options only. It does not approve invoices, send payment instructions, receive funds, convert assets, grant tokens, move assets, or record state.'
  };
}

export function renderSettlementOptionsMarkdown(brief) {
  const lines = [
    `# ${brief.project} Settlement Options Brief`,
    '',
    `Generated: ${brief.generatedAtUtc}`,
    `Reserve: ${brief.reserve.confirmedSats} sats confirmed, ${brief.reserve.remainingSats} sats remaining.`,
    '',
    '## Boundary',
    brief.boundary,
    '',
    '## Direct Reserve Path',
    `Currency: ${brief.directReservePath.settlementCurrency}`,
    `Status: ${brief.directReservePath.status}`,
    `Quote rule: ${brief.directReservePath.quoteRule}`,
    `Custody rule: ${brief.directReservePath.custodyRule}`,
    `Payment address policy: ${brief.directReservePath.paymentAddressPolicy}`,
    `Reserve address source: ${brief.directReservePath.reserveAddressSource}`,
    '',
    '## BTC Invoice Templates'
  ];

  for (const offer of brief.directReservePath.supportedOffers) {
    lines.push(
      '',
      `### ${offer.offerId}`,
      `${offer.label} / $${offer.priceUsd}`,
      `Template ready: ${offer.hasTemplate}`,
      '',
      '```sh',
      offer.quoteCommand,
      '```'
    );
  }

  lines.push('', '## Alternative Settlement Paths');
  for (const option of brief.alternativeSettlementPaths) {
    lines.push(
      '',
      `### ${option.settlementCurrency}`,
      `Status: ${option.status}`,
      option.customerReply,
      '',
      'Required before use:',
      ...option.requiredBeforeUse.map((item) => `- ${item}`),
      '',
      `Stop rule: ${option.stopRule}`
    );
  }

  lines.push(
    '',
    '## Customer Reply Templates',
    '',
    '### BTC Preferred',
    '```text',
    brief.customerReplyTemplates.btcPreferred,
    '```',
    '',
    '### Alternative Requested',
    '```text',
    brief.customerReplyTemplates.alternativeRequested,
    '```',
    '',
    '## Stop Rules',
    ...brief.stopRules.map((rule) => `- ${rule}`),
    '',
    '## Next Action',
    brief.nextAction
  );
  return `${lines.join('\n')}\n`;
}

async function writeSettlementOptionsBrief(brief) {
  const jsonPath = join('public', 'settlement-options-brief.json');
  const markdownPath = join('public', 'settlement-options-brief.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(brief, null, 2)}\n`),
    writeFile(markdownPath, renderSettlementOptionsMarkdown(brief))
  ]);
  console.log(
    JSON.stringify(
      { wrote: [jsonPath, markdownPath], directReserveOffers: brief.directReservePath.supportedOffers.length },
      null,
      2
    )
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
