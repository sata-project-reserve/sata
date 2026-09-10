import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildRevenueExecutionBrief,
  renderRevenueExecutionMarkdown,
  validateRevenueExecutionBrief
} from './revenue-execution-brief.mjs';
import { buildRevenueCycleStatus, validateRevenueCycleStatus } from './revenue-cycle-status.mjs';
import {
  buildOutreachDispatchBrief,
  renderOutreachDispatchMarkdown
} from '../outreach-dispatch-brief-agent.mjs';
import {
  buildReplyConversionBrief,
  renderReplyConversionMarkdown
} from '../reply-conversion-brief-agent.mjs';
import {
  buildReferralHandoffDispatchBrief,
  renderReferralHandoffDispatchMarkdown
} from '../referral-handoff-dispatch-brief-agent.mjs';

export const REVENUE_CYCLE_PUBLIC_PATHS = {
  report: join('public', 'transparency', 'latest.json'),
  revenuePlan: join('public', 'revenue-operating-plan.json'),
  ledger: join('public', 'sats-generation-ledger.json'),
  invoiceQueue: join('public', 'sats-invoice-queue.json'),
  prospectPipeline: join('public', 'sats-prospect-pipeline.json'),
  outreachPacketQueue: join('public', 'service-outreach-packet-queue.json'),
  inboundLeadQueue: join('public', 'inbound-service-lead-queue.json'),
  paidPromotionLedger: join('public', 'paid-promotion-ledger.json'),
  referralPartnerPolicy: join('public', 'referral-partner-policy.json'),
  referralPartnerHandoffQueue: join('public', 'referral-partner-handoff-queue.json'),
  referralPartnerHandoffPacket: join('public', 'referral-partner-handoff-packet.json'),
  approvalQueue: join('public', 'executive-approval-queue.json'),
  socialQueue: join('public', 'social-agent-content-queue.json')
};

export async function readRevenueCyclePublicInputs(paths = REVENUE_CYCLE_PUBLIC_PATHS) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, path]) => [
        key,
        key === 'referralPartnerHandoffPacket' ? await readOptionalJson(path) : await readJson(path)
      ])
    )
  );
}

export function buildRevenueCyclePublicStatus(inputs, env = process.env) {
  const status = buildRevenueCycleStatus({ ...inputs, env });
  validateRevenueCycleStatus(status);
  return status;
}

export async function writeRevenueCyclePublicStatus({
  paths = REVENUE_CYCLE_PUBLIC_PATHS,
  statusPath = join('public', 'revenue-cycle-status.json'),
  revenueExecutionBriefJsonPath = join('public', 'revenue-execution-brief.json'),
  revenueExecutionBriefMarkdownPath = join('public', 'revenue-execution-brief.md'),
  outreachDispatchBriefJsonPath = join('public', 'outreach-dispatch-brief.json'),
  outreachDispatchBriefMarkdownPath = join('public', 'outreach-dispatch-brief.md'),
  replyConversionBriefJsonPath = join('public', 'reply-conversion-brief.json'),
  replyConversionBriefMarkdownPath = join('public', 'reply-conversion-brief.md'),
  referralHandoffDispatchBriefJsonPath = join('public', 'referral-handoff-dispatch-brief.json'),
  referralHandoffDispatchBriefMarkdownPath = join('public', 'referral-handoff-dispatch-brief.md'),
  env = process.env
} = {}) {
  const inputs = await readRevenueCyclePublicInputs(paths);
  const status = buildRevenueCyclePublicStatus(inputs, env);
  const generatedAtUtc = new Date(
    env.SATA_REVENUE_OPS_GENERATED_AT_UTC ?? new Date().toISOString()
  ).toISOString();
  const revenueExecutionBrief = buildRevenueExecutionBrief({
    status,
    paidPromotionLedger: inputs.paidPromotionLedger,
    outreachPacketQueue: inputs.outreachPacketQueue,
    socialQueue: inputs.socialQueue,
    prospectPipeline: inputs.prospectPipeline,
    revenuePlan: inputs.revenuePlan,
    referralPartnerPolicy: inputs.referralPartnerPolicy,
    referralPartnerHandoffQueue: inputs.referralPartnerHandoffQueue,
    referralPartnerHandoffPacket: inputs.referralPartnerHandoffPacket,
    maxManualSends: 5,
    generatedAtUtc
  });
  validateRevenueExecutionBrief(revenueExecutionBrief);
  const outreachDispatchBrief = buildOutreachDispatchBrief({
    status,
    packetQueue: inputs.outreachPacketQueue,
    approvalQueue: inputs.approvalQueue,
    revenuePlan: inputs.revenuePlan,
    prospectPipeline: inputs.prospectPipeline,
    maxManualSends: 5,
    generatedAtUtc
  });
  const replyConversionBrief = buildReplyConversionBrief({
    status,
    prospectPipeline: inputs.prospectPipeline,
    outreachPacketQueue: inputs.outreachPacketQueue,
    inboundLeadQueue: inputs.inboundLeadQueue,
    revenuePlan: inputs.revenuePlan,
    generatedAtUtc
  });
  const referralHandoffDispatchBrief = buildReferralHandoffDispatchBrief({
    queue: inputs.referralPartnerHandoffQueue,
    paidPromotionLedger: inputs.paidPromotionLedger,
    referralPartnerPolicy: inputs.referralPartnerPolicy,
    inboundQueue: inputs.inboundLeadQueue,
    packetArtifact: inputs.referralPartnerHandoffPacket,
    generatedAtUtc
  });
  await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  await Promise.all([
    writeFile(revenueExecutionBriefJsonPath, `${JSON.stringify(revenueExecutionBrief, null, 2)}\n`),
    writeFile(
      revenueExecutionBriefMarkdownPath,
      renderRevenueExecutionMarkdown(revenueExecutionBrief)
    ),
    writeFile(outreachDispatchBriefJsonPath, `${JSON.stringify(outreachDispatchBrief, null, 2)}\n`),
    writeFile(
      outreachDispatchBriefMarkdownPath,
      renderOutreachDispatchMarkdown(outreachDispatchBrief)
    ),
    writeFile(replyConversionBriefJsonPath, `${JSON.stringify(replyConversionBrief, null, 2)}\n`),
    writeFile(
      replyConversionBriefMarkdownPath,
      renderReplyConversionMarkdown(replyConversionBrief)
    ),
    writeFile(
      referralHandoffDispatchBriefJsonPath,
      `${JSON.stringify(referralHandoffDispatchBrief, null, 2)}\n`
    ),
    writeFile(
      referralHandoffDispatchBriefMarkdownPath,
      renderReferralHandoffDispatchMarkdown(referralHandoffDispatchBrief)
    )
  ]);
  return status;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
