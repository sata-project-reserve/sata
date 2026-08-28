import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildTransparencyAuditArtifact } from './lib/transparency-audit-artifact.mjs';

const DELIVERY_KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');
const PROSPECT_PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const [deliveryKit, prospectPipeline, invoiceQueue] = await Promise.all([
    readJson(DELIVERY_KIT_PATH),
    readJson(PROSPECT_PIPELINE_PATH),
    readJson(INVOICE_QUEUE_PATH)
  ]);

  switch (command) {
    case 'plan':
      printPlan(deliveryKit);
      break;
    case 'draft-from-issue-json':
      await printDraft(args[0], { deliveryKit, prospectPipeline, invoiceQueue });
      break;
    default:
      throw new Error(
        `Unknown transparency-audit-artifact command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

function printPlan(deliveryKit) {
  console.log(
    JSON.stringify(
      {
        project: deliveryKit.project,
        mode: 'draft-transparency-audit-artifact-generator',
        format: deliveryKit.deliverableTemplate.format,
        sections: deliveryKit.deliverableTemplate.sections,
        requiredDisclosures: deliveryKit.deliverableTemplate.requiredDisclosures,
        nextAction:
          'Run draft-from-issue-json after a service-intake issue is complete and the prospect/invoice path is ready for chairman review.',
        boundary:
          'The artifact generator drafts Markdown only. It does not verify claims by itself, approve public release, issue invoices, or accept funds.'
      },
      null,
      2
    )
  );
}

async function printDraft(path, context) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(buildTransparencyAuditArtifact({ issue, ...context }));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
