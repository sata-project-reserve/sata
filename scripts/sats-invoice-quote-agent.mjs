import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildInvoiceQuoteDraft } from './lib/sats-invoice-quote.mjs';

const QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const queue = await readJson(QUEUE_PATH);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'quote-template':
    printQuoteTemplate();
    break;
  default:
    throw new Error(`Unknown sats invoice quote command: ${command}. Use plan or quote-template.`);
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: queue.project,
        mode: 'manual-rate-sats-invoice-quoter',
        quoteRule: queue.paymentPolicy.quoteRule,
        reserveAddress: queue.paymentPolicy.reserveAddress,
        availableTemplates: (queue.invoices ?? [])
          .filter((invoice) => invoice.status === 'template')
          .map((invoice) => ({
            offerId: invoice.offerId,
            usdPrice: invoice.usdPrice,
            settlementCurrency: invoice.settlementCurrency
          })),
        nextAction:
          'Run quote-template with a chairman-selected BTC/USD rate and source to draft an exact sats invoice for approval.',
        boundary:
          'The quote engine drafts invoice records only. It does not fetch prices, send payment instructions, accept funds, or approve invoices.'
      },
      null,
      2
    )
  );
}

function printQuoteTemplate() {
  const options = parseOptions(args);
  const quote = buildInvoiceQuoteDraft({
    queue,
    offerId: options.offerId,
    customer: options.customer,
    btcUsd: options.btcUsd,
    quoteSource: options.quoteSource,
    createdAtUtc: options.createdAtUtc,
    ttlMinutes: options.ttlMinutes ? Number(options.ttlMinutes) : 30
  });
  console.log(JSON.stringify(quote, null, 2));
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) {
      throw new Error('Options must be provided as --key value pairs.');
    }
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}.`);
    const value = collected.join(' ');
    options[key.slice(2)] = value;
  }

  return {
    offerId: options.offerId ?? options.offer,
    customer: options.customer,
    btcUsd: options.btcUsd,
    quoteSource: options.quoteSource ?? options.source,
    createdAtUtc: options.createdAtUtc,
    ttlMinutes: options.ttlMinutes
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
