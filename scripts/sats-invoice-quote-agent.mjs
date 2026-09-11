import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildInvoiceQuoteDraft,
  finalizeChairmanApprovedInvoice,
  stageInvoiceQuoteForChairmanReview
} from './lib/sats-invoice-quote.mjs';
import { writeRevenueCyclePublicStatus } from './lib/revenue-cycle-public-state.mjs';

const QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const APPROVAL_QUEUE_PATH = join('public', 'executive-approval-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const queue = await readJson(QUEUE_PATH);
const approvalQueue = await readJson(APPROVAL_QUEUE_PATH);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'quote-template':
    printQuoteTemplate();
    break;
  case 'write-draft':
    await writeDraft();
    break;
  case 'finalize-approved':
    await finalizeApproved();
    break;
  default:
    throw new Error(
      `Unknown sats invoice quote command: ${command}. Use plan, quote-template, write-draft, or finalize-approved.`
    );
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
          'Run write-draft with a chairman-selected BTC/USD rate, source, createdAtUtc timestamp, ttlMinutes, and invoice-request evidence to stage an exact-sats invoice for chairman approval.',
        boundary:
          'The quote engine drafts invoice records only. It does not fetch prices, send payment instructions, accept funds, approve invoices, or move assets.'
      },
      null,
      2
    )
  );
}

function printQuoteTemplate() {
  const options = parseOptions(args);
  const quote = buildQuoteFromOptions(options);
  console.log(JSON.stringify(quote, null, 2));
}

async function writeDraft() {
  const options = parseOptions(args);
  if (!options.evidence) {
    throw new Error('write-draft requires --evidence with invoice-request evidence.');
  }
  const quote = buildQuoteFromOptions(options);
  const staged = stageInvoiceQuoteForChairmanReview({
    invoiceQueue: queue,
    approvalQueue,
    quote,
    evidence: options.evidence,
    createdAtUtc: quote.quoteCreatedAtUtc
  });

  await writeJson(QUEUE_PATH, staged.invoiceQueue);
  await writeJson(APPROVAL_QUEUE_PATH, staged.approvalQueue);
  await writeRevenueCyclePublicStatus();
  console.log(
    JSON.stringify(
      {
        invoiceId: quote.id,
        approvalItemId: staged.approvalItem.id,
        status: quote.status,
        amountSats: quote.amountSats,
        nextAction: `Chairman reviews ${staged.approvalItem.id}; only after approval can finalize-approved mark ${quote.id} approved.`,
        boundary:
          'Draft staged only. No payment packet is rendered, no payment instruction is sent, no funds are received, and no assets move.'
      },
      null,
      2
    )
  );
}

async function finalizeApproved() {
  const options = parseOptions(args);
  const invoiceId = options.invoice ?? options.invoiceId;
  if (!invoiceId) throw new Error('finalize-approved requires --invoice <invoice-id>.');
  const confirmation = options.confirmChairmanInvoiceApproval ?? '';
  const expected = `I am Executive Chairman and approve invoice ${invoiceId}`;
  if (confirmation !== expected) {
    throw new Error(`Missing exact chairman invoice approval phrase: "${expected}"`);
  }

  const updatedQueue = finalizeChairmanApprovedInvoice({
    invoiceQueue: queue,
    approvalQueue,
    invoiceId,
    approvalId: options.approval ?? options.approvalId,
    approvedAtUtc: options.approvedAtUtc
  });

  await writeJson(QUEUE_PATH, updatedQueue);
  await writeRevenueCyclePublicStatus();
  console.log(
    JSON.stringify(
      {
        invoiceId,
        status: 'approved-by-chairman',
        nextAction: `Render the manual customer payment packet with: node scripts/sats-invoice-payment-packet-agent.mjs render ${invoiceId}`,
        boundary:
          'Invoice approval is recorded only after the matching chairman approval item is approved. Rendering and sending the payment packet remains manual.'
      },
      null,
      2
    )
  );
}

function buildQuoteFromOptions(options) {
  return buildInvoiceQuoteDraft({
    queue,
    offerId: options.offerId,
    customer: options.customer,
    btcUsd: options.btcUsd,
    quoteSource: options.quoteSource,
    createdAtUtc: options.createdAtUtc,
    ttlMinutes: options.ttlMinutes ? Number(options.ttlMinutes) : 30
  });
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

  options.offerId ??= options.offer;
  options.quoteSource ??= options.source;
  options.invoiceId ??= options.invoice;
  options.invoice ??= options.invoiceId;
  options.approvalId ??= options.approval;
  options.approval ??= options.approvalId;

  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
