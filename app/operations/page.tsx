import approvalQueue from '@/public/executive-approval-queue.json';
import inboundLeadQueue from '@/public/inbound-service-lead-queue.json';
import outreachDispatchBrief from '@/public/outreach-dispatch-brief.json';
import outreachPacketQueue from '@/public/service-outreach-packet-queue.json';
import paidPromotionLedger from '@/public/paid-promotion-ledger.json';
import prospectPipeline from '@/public/sats-prospect-pipeline.json';
import referralPartnerHandoffPacket from '@/public/referral-partner-handoff-packet.json';
import referralPartnerHandoffQueue from '@/public/referral-partner-handoff-queue.json';
import referralPartnerPolicy from '@/public/referral-partner-policy.json';
import replyConversionBrief from '@/public/reply-conversion-brief.json';
import revenueExecutionBrief from '@/public/revenue-execution-brief.json';
import revenuePlan from '@/public/revenue-operating-plan.json';
import socialDispatchBrief from '@/public/social-dispatch-brief.json';
import socialQueue from '@/public/social-agent-content-queue.json';
import settlementOptionsBrief from '@/public/settlement-options-brief.json';
import cycleStatus from '@/public/revenue-cycle-status.json';
import report from '@/public/transparency/latest.json';
import { publicPath } from '@/lib/public-path';

export const metadata = {
  title: 'SATA Operations Queue',
  description:
    'Current SATA reserve-growth operating queue, chairman approvals, and prospect review status.',
  alternates: {
    canonical: 'https://sata-project-reserve.github.io/sata/operations'
  }
};

const PUBLIC_BASE_URL = 'https://sata-project-reserve.github.io/sata';
const CONTACT_EVIDENCE_INTAKE_URL =
  'https://github.com/sata-project-reserve/sata/issues/new?template=outreach-contact-evidence.yml';

type ApprovalItem = (typeof approvalQueue.items)[number];
type PaidPromotionCampaign = (typeof paidPromotionLedger.campaigns)[number];
type Prospect = (typeof prospectPipeline.prospects)[number];
type RevenueExecutionAction = (typeof revenueExecutionBrief.topActions)[number];
type ActionQueueItem = (typeof cycleStatus.actionQueue)[number] & {
  artifact?: string;
};
type SocialPost = (typeof socialQueue.posts)[number];
type ReferralPartnerHandoff = {
  id: string;
  sourceCampaignId: string;
  partner: {
    id: string;
    displayName: string;
    handle: string;
  };
  sourceEvidence: string;
  sentEvidence: string;
  status: string;
  nextAction: string;
};
type InboundLead = {
  id: string;
  status: string;
  sourceType: string;
  sourceId: string;
  contactHandle: string;
  publicProfileUrl: string;
  projectUrl: string;
  requestedOfferId: string;
  evidence: string;
};
type InboundSource = {
  type: string;
  id: string;
  url: string | undefined;
  label: string;
};

const PROSPECT_STAGES = [
  'identified',
  'chairman-review',
  'outreach-approved',
  'contacted',
  'invoice-requested'
];

function countByStatus(items: ApprovalItem[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}

function countByStage(items: Prospect[]) {
  return items.reduce<Record<string, number>>(
    (counts, item) => {
      counts[item.stage] = (counts[item.stage] ?? 0) + 1;
      return counts;
    },
    Object.fromEntries(PROSPECT_STAGES.map((stage) => [stage, 0]))
  );
}

function approvalPhrase(id: string) {
  return `I am Executive Chairman and approve ${id}`;
}

function rejectionPhrase(id: string) {
  return `I am Executive Chairman and reject ${id}`;
}

function approvalCommand(item: ApprovalItem) {
  return `npm run ops:approve -- ${item.id} --confirm-chairman-approval "${approvalPhrase(item.id)}"`;
}

function rejectionCommand(item: ApprovalItem) {
  return `npm run ops:reject -- ${item.id} --confirm-chairman-rejection "${rejectionPhrase(item.id)}"`;
}

function nextCommandAfterApproval(item: ApprovalItem, reviewBatch: Prospect[]) {
  if (item.id.startsWith('prospect-review-batch-')) {
    const prospectIds =
      prospectIdsFromReviewSummary(item.summary) ||
      reviewBatch.map((prospect) => prospect.id).join(',');
    return `node scripts/sats-prospect-stage-agent.mjs plan --approvalId ${item.id}, then node scripts/sats-prospect-stage-agent.mjs advance --approvalId ${item.id} --prospects ${prospectIds} --transitionedAtUtc "<transitioned-at-utc>"`;
  }
  if (item.id === 'reserve-growth-operating-policy') return 'npm run ops:reserve-plan';
  if (item.id === 'standard-promoter-intake-policy') return 'npm run ops:plan';
  if (item.id.startsWith('outreach-approval-')) {
    const prospectIds = outreachProspectIdsFromTitle(item.title);
    return `node scripts/sats-outreach-approval-agent.mjs transition-plan --approvalId ${item.id}, then node scripts/sats-outreach-approval-agent.mjs advance --approvalId ${item.id} --prospects ${prospectIds || '<chairman-approved-prospect-ids>'} --transitionedAtUtc "<transitioned-at-utc>"`;
  }
  return 'npm run ops:cycle-plan';
}

function outreachProspectIdsFromTitle(title: string) {
  const match = /^Approve factual outreach to (?<ids>.+)$/.exec(title);
  const ids = match?.groups?.ids;
  if (!ids) return '';
  return ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .join(',');
}

function prospectIdsFromReviewSummary(summary: string) {
  const match = /^Review (?<ids>.+?) as /i.exec(summary);
  const ids = match?.groups?.ids;
  if (!ids) return '';
  return ids
    .replace(/\band\b/g, ',')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .join(',');
}

function trackedPublicUrl(path: string, params: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, cleanTrackingValue(value));
  }
  return `${PUBLIC_BASE_URL}${path}?${query.toString()}`;
}

function cleanTrackingValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
}

function satsFromUsd(usd: number, btcUsd: number) {
  return BigInt(Math.floor((usd / btcUsd) * 100_000_000));
}

function dealsRequired(targetSats: bigint, satsPerDeal: bigint) {
  if (targetSats <= 0n) return 0;
  if (satsPerDeal <= 0n) return Number.MAX_SAFE_INTEGER;
  return Number((targetSats + satsPerDeal - 1n) / satsPerDeal);
}

function percentString(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) return '0.00';
  const percentBasisPoints = (numerator * 1_000_000n) / denominator;
  return (Number(percentBasisPoints) / 10_000).toFixed(2);
}

function recordContactedCommand(prospect: Prospect) {
  const packet = outreachPacketQueue.packets.find(
    (item) => item.prospectId === prospect.id && item.status === 'ready-for-manual-send'
  );
  return withSentAtUtcPlaceholder(
    packet?.recordContactCommand ??
      `node scripts/sats-prospect-response-agent.mjs record-contacted --prospect ${prospect.id} --evidence "<contact-evidence-url-or-reference>" --channel "manual-dm-or-email" --contactedAtUtc "<contacted-at-utc>"`
  );
}

function withSentAtUtcPlaceholder(command: string) {
  if (!/service-outreach-packet-agent\.mjs mark-sent/.test(command)) return command;
  if (/--sentAtUtc\b/.test(command)) return command;
  return `${command} --sentAtUtc "<sent-at-utc>"`;
}

function recordInvoiceRequestCommand(prospect: Prospect) {
  return `node scripts/sats-prospect-response-agent.mjs record-invoice-request --prospect ${prospect.id} --offer ${prospect.recommendedOfferId} --evidence "<invoice-request-evidence-url-or-reference>" --confirmedCustomerRequestedInvoice true --requestedAtUtc "<requested-at-utc>"`;
}

function approveSocialPostCommand(post: SocialPost) {
  return `npm run social:agent -- approve-post --post ${post.id} --confirmChairmanApproval "I am Executive Chairman and approve social post ${post.id}"`;
}

function rejectSocialPostCommand(post: SocialPost) {
  return `npm run social:agent -- reject-post --post ${post.id} --confirmChairmanRejection "I am Executive Chairman and reject social post ${post.id}"`;
}

function recordPublishedSocialPostCommand(post: SocialPost) {
  const contentHash = 'contentSha256' in post ? post.contentSha256 : '<approved-post-sha256>';
  return `npm run social:agent -- record-published --post ${post.id} --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash ${contentHash}`;
}

function recordInboundLeadCommand(source: InboundSource) {
  return `node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType ${source.type} --sourceId ${source.id} --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<reply-or-dm-evidence>" --customerAskedForInvoice false --recordedAtUtc "<recorded-at-utc>"`;
}

function renderInboundInvoiceRequestCommand(lead: InboundLead) {
  return `node scripts/inbound-invoice-request-agent.mjs render --lead ${lead.id}`;
}

function recordPaidPromotionConversionCommand(campaign: PaidPromotionCampaign) {
  return `node scripts/paid-promotion-agent.mjs record-conversion --campaign ${campaign.id} --evidence "<24h-analytics-and-inquiry-log>" --profileViewLift "<profile-view-change-or-not-recorded>" --trackedClicks 0 --serviceInquiries 0 --invoiceRequests 0 --confirmedReceiptsSats 0 --measuredAtUtc "<measured-at-utc>"`;
}

function referralPartnerPacketCommand() {
  return 'npm run ops:referral-packet-plan -- --partner "diana-crypto" --displayName "Diana Crypto" --handle "142C_" --sourceEvidence "<dm-or-reply-evidence>" --requestedCompensation "post-receipt referral share"';
}

function renderReferralHandoffCommand(campaign: PaidPromotionCampaign) {
  return `node scripts/referral-partner-handoff-agent.mjs render --campaign ${campaign.id}`;
}

function writeReferralHandoffPacketCommand(campaign: PaidPromotionCampaign) {
  return `node scripts/referral-partner-handoff-agent.mjs write-packet --campaign ${campaign.id}`;
}

function publicArtifactPath(artifact: string) {
  return publicPath(`/${artifact.replace(/^public\//, '')}`);
}

function recordReferralHandoffSentCommand(campaign: PaidPromotionCampaign) {
  if (
    referralPartnerHandoffPacket.sourceCampaignId === campaign.id &&
    referralPartnerHandoffPacket.recordSentCommand
  ) {
    return referralPartnerHandoffPacket.recordSentCommand;
  }
  return `node scripts/referral-partner-handoff-agent.mjs record-sent --campaign ${campaign.id} --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>" --messageHash "<approved-terms-sha256>"`;
}

function recordReferralHandoffResponseCommand(handoff: ReferralPartnerHandoff) {
  return `node scripts/referral-partner-handoff-agent.mjs record-response --handoff ${handoff.id} --accepted true --evidence "<partner-response-evidence>" --respondedAtUtc "<responded-at-utc>"`;
}

function recordReferralLeadCommand(handoff: ReferralPartnerHandoff) {
  return `node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType manual-referral --sourceId referral-partner-${handoff.partner.id} --contactHandle "<customer-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<referral-and-customer-interest-evidence>" --customerAskedForInvoice false --recordedAtUtc "<recorded-at-utc>" --convertedAtUtc "<converted-at-utc>"`;
}

function referralPolicySummary() {
  if (referralPartnerPolicy.status === 'approved-by-chairman') {
    return 'Approved post-receipt partner compensation policy ready for gated referral packet generation.';
  }
  return 'Draft post-receipt partner compensation policy awaiting chairman decision.';
}

export default function OperationsPage() {
  const approvalCounts = countByStatus(approvalQueue.items);
  const prospectCounts = countByStage(prospectPipeline.prospects);
  const reviewItems = approvalQueue.items.filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  const reviewBatch = prospectPipeline.prospects
    .filter((prospect) => prospect.stage === 'identified')
    .slice(0, prospectPipeline.dailyCadence.chairmanReviewBatchSize);
  const chairmanReviewProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'chairman-review'
  );
  const outreachApprovedProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'outreach-approved'
  );
  const contactedProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'contacted'
  );
  const invoiceRequestedProspects = prospectPipeline.prospects.filter(
    (prospect) => prospect.stage === 'invoice-requested'
  );
  const socialPostsReadyForReview = socialQueue.posts.filter(
    (post) => post.status === 'ready-for-review'
  );
  const approvedSocialPosts = socialQueue.posts.filter((post) => post.status === 'approved');
  const outreachDispatchSprint = outreachDispatchBrief.readyManualSends;
  const outreachDispatchRemainder = Math.max(
    outreachDispatchBrief.readyManualSendCount - outreachDispatchSprint.length,
    0
  );
  const outreachDispatchGrossRevenueUsd = Number(
    outreachDispatchBrief.sprintEconomics.grossRevenueUsd
  );
  const outreachDispatchQualifiedGrossRevenueUsd = Number(
    outreachDispatchBrief.sprintEconomics.qualifiedGrossRevenueUsd
  );
  const outreachDispatchReserveAllocationPercent =
    outreachDispatchBrief.sprintEconomics.reserveAllocationPercent;
  const outreachDispatchReserveUsd = Number(
    outreachDispatchBrief.sprintEconomics.reserveAllocationUsd
  );
  const outreachDispatchQualifiedReserveUsd = Number(
    outreachDispatchBrief.sprintEconomics.qualifiedReserveAllocationUsd
  );
  const outreachDispatchReserveSatsAtPlanningRate =
    outreachDispatchBrief.sprintEconomics.reserveSatsAtPlanningRate;
  const outreachDispatchQualifiedReserveSatsAtPlanningRate =
    outreachDispatchBrief.sprintEconomics.qualifiedReserveSatsAtPlanningRate;
  const paidPromotionsAwaitingVerification = paidPromotionLedger.campaigns.filter((campaign) =>
    ['paid-awaiting-post', 'post-reported-unverified'].includes(campaign.status)
  );
  const liveVerifiedPaidPromotions = paidPromotionLedger.campaigns.filter(
    (campaign) => campaign.status === 'live-verified'
  );
  const referralHandoffs = referralPartnerHandoffQueue.handoffs as ReferralPartnerHandoff[];
  const recordedReferralHandoffCampaignIds = new Set(
    referralHandoffs.map((handoff) => handoff.sourceCampaignId)
  );
  const referralHandoffCandidates = paidPromotionLedger.campaigns.filter(
    (campaign) =>
      campaign.status === 'completed' &&
      BigInt(campaign.conversion.confirmedReceiptsSats) === 0n &&
      referralPartnerPolicy.status === 'approved-by-chairman' &&
      !recordedReferralHandoffCampaignIds.has(campaign.id)
  );
  const activeReferralHandoffs = referralHandoffs.filter(
    (handoff) => !['converted-to-lead', 'declined', 'closed-no-response'].includes(handoff.status)
  );
  const inboundLeads = inboundLeadQueue.leads as InboundLead[];
  const inboundInvoiceRequests = inboundLeads.filter(
    (lead) => lead.status === 'invoice-requested-needs-chairman-review'
  );
  const inboundSources: InboundSource[] = [
    ...paidPromotionLedger.campaigns
      .filter((campaign) => ['live-verified', 'completed'].includes(campaign.status))
      .map((campaign) => ({
        type: 'paid-promotion-reply',
        id: campaign.id,
        url: campaign.verifiedPostUrl ?? campaign.reportedPostUrl,
        label: `Paid promotion from @${campaign.promoter.handle}`
      })),
    ...socialQueue.posts
      .filter((post) => post.status === 'published')
      .map((post) => ({
        type: 'published-social-reply',
        id: post.id,
        url: post.postUrl,
        label: `Published @${socialQueue.account.handle} post ${post.id}`
      }))
  ];
  const referralPolicyApprovalItem = approvalQueue.items.find(
    (item) => item.id === referralPartnerPolicy.approvalItemId
  );
  const revenueExecutionActions: RevenueExecutionAction[] = revenueExecutionBrief.topActions;
  const actionQueue = cycleStatus.actionQueue as ActionQueueItem[];
  const paidAttributionLinks = paidPromotionLedger.campaigns.map((campaign) => ({
    id: campaign.id,
    promoter: campaign.promoter.handle,
    transparencyUrl: trackedPublicUrl('/transparency', {
      utm_source: `x_${campaign.promoter.handle}`,
      utm_medium: 'paid_promotion',
      utm_campaign: campaign.id,
      utm_content: 'transparency_report'
    }),
    serviceUrl: trackedPublicUrl('/services/transparency-audit', {
      utm_source: `x_${campaign.promoter.handle}`,
      utm_medium: 'paid_promotion',
      utm_campaign: campaign.id,
      utm_content: 'audit_service'
    })
  }));
  const outreachAttributionLinks = outreachPacketQueue.packets
    .filter((packet) => packet.status === 'ready-for-manual-send')
    .slice(0, 5)
    .map((packet) => ({
      packetId: packet.id,
      prospectId: packet.prospectId,
      serviceUrl: trackedPublicUrl('/services/transparency-audit', {
        utm_source: 'manual_outreach',
        utm_medium: packet.channel,
        utm_campaign: packet.id,
        utm_content: packet.prospectId
      }),
      transparencyUrl: trackedPublicUrl('/transparency', {
        utm_source: 'manual_outreach',
        utm_medium: packet.channel,
        utm_campaign: packet.id,
        utm_content: packet.prospectId
      })
    }));
  const btcUsdPlanningAssumption = 100000;
  const reserveAllocationPercent =
    revenuePlan.allocationPolicy.postReceiptAllocationPercent.btcReserve;
  const nextMilestoneAdditionalSats = BigInt(
    Number(cycleStatus.currentReserve.confirmedSats) >= 1000000
      ? 0
      : 1000000 - Number(cycleStatus.currentReserve.confirmedSats)
  );
  const remainingSats = BigInt(cycleStatus.currentReserve.remainingSats);
  const targetScenarios = revenuePlan.revenueStreams.map((stream) => {
    const reserveUsdPerDeal = (Number(stream.priceUsd) * reserveAllocationPercent) / 100;
    const reserveSatsPerDeal = satsFromUsd(reserveUsdPerDeal, btcUsdPlanningAssumption);
    return {
      id: stream.id,
      label: stream.label,
      priceUsd: stream.priceUsd,
      reserveSatsPerDeal: reserveSatsPerDeal.toString(),
      dealsToNextMilestone: dealsRequired(nextMilestoneAdditionalSats, reserveSatsPerDeal),
      dealsToFullTarget: dealsRequired(remainingSats, reserveSatsPerDeal)
    };
  });
  const manualOutreachActions = cycleStatus.actionQueue.filter(
    (item) => item.type === 'manual-outreach-send'
  );
  const manualOutreachQualifiedRevenueUsd = manualOutreachActions.reduce(
    (total, item) => total + Number((item as { qualifiedRevenueUsd?: string }).qualifiedRevenueUsd ?? 0),
    0
  );
  const manualOutreachReserveSats = satsFromUsd(
    (manualOutreachQualifiedRevenueUsd * reserveAllocationPercent) / 100,
    btcUsdPlanningAssumption
  );
  const nextMilestoneCloseRate = percentString(
    nextMilestoneAdditionalSats,
    manualOutreachReserveSats
  );
  const nextMilestoneCoverage = percentString(
    manualOutreachReserveSats,
    nextMilestoneAdditionalSats
  );

  return (
    <main className="public-page">
      <section className="public-hero">
        <div>
          <span className="eyebrow">SATA operations</span>
          <h1>Reserve growth queue.</h1>
          <p>
            Current operating view for moving from public evidence to chairman review, approved
            outreach, exact-sats invoices, confirmed receipts, and reserve allocation records.
          </p>
          <p>
            Agents prepare packets and validations. The Executive Chairman approves final proposals,
            outreach, invoices, paid promotion, token grants, transactions, and asset movement.
          </p>
          <div className="inline-actions">
            <a className="button-link" href={publicPath('/transparency')}>
              Transparency
            </a>
            <a className="button-link" href={publicPath('/services/transparency-audit')}>
              Audit Service
            </a>
            <a className="button-link" href={publicPath('/executive-approval-queue.json')}>
              Approval JSON
            </a>
            <a className="button-link" href={publicPath('/sats-prospect-pipeline.json')}>
              Prospect JSON
            </a>
            <a className="button-link" href={publicPath('/service-outreach-packet-queue.json')}>
              Outreach Queue
            </a>
            <a className="button-link" href={CONTACT_EVIDENCE_INTAKE_URL}>
              Contact Evidence
            </a>
            <a className="button-link" href={publicPath('/outreach-dispatch-brief.md')}>
              Dispatch Brief
            </a>
            <a className="button-link" href={publicPath('/reply-conversion-brief.md')}>
              Reply Brief
            </a>
            <a className="button-link" href={publicPath('/referral-handoff-dispatch-brief.md')}>
              Referral Handoff Brief
            </a>
            <a className="button-link" href={publicPath('/social-dispatch-brief.md')}>
              Social Dispatch Brief
            </a>
            <a className="button-link" href={publicPath('/settlement-options-brief.md')}>
              Settlement Brief
            </a>
            <a className="button-link" href={publicPath('/revenue-execution-brief.md')}>
              Execution Brief
            </a>
            <a className="button-link" href={publicPath('/partners/referrals')}>
              Referral Partners
            </a>
          </div>
        </div>
        <div className="proof-stack">
          <div className="metric">
            <span>Confirmed Reserve</span>
            <strong>{report.bitcoinReserve.confirmedReserveSats} sats</strong>
          </div>
          <div className="metric">
            <span>Target</span>
            <strong>1,000,000,000 sats</strong>
          </div>
          <div className="metric">
            <span>Latest Report</span>
            <strong>{report.generatedAtUtc}</strong>
          </div>
          <div className="metric">
            <span>Chairman Review Items</span>
            <strong>{reviewItems.length}</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Cycle Status</h2>
          <p>{cycleStatus.objective}</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Remaining To Target</span>
            <strong>
              {Number(cycleStatus.currentReserve.remainingSats).toLocaleString('en-US')} sats
            </strong>
          </div>
          <div className="metric">
            <span>Remaining BTC</span>
            <strong>{cycleStatus.currentReserve.remainingBtc} BTC</strong>
          </div>
          <div className="metric">
            <span>Approved Invoices</span>
            <strong>{cycleStatus.funnel.approvedInvoices}</strong>
          </div>
          <div className="metric">
            <span>Receipts Awaiting Allocation</span>
            <strong>{cycleStatus.funnel.receiptsAwaitingAllocation}</strong>
          </div>
          <div className="metric">
            <span>Ready Outreach Packets</span>
            <strong>{cycleStatus.funnel.readyOutreachPackets}</strong>
          </div>
          <div className="metric">
            <span>Inbound Invoice Requests</span>
            <strong>{cycleStatus.funnel.inboundInvoiceRequestsNeedingChairmanReview}</strong>
          </div>
          <div className="metric">
            <span>Due Follow-Ups</span>
            <strong>{cycleStatus.funnel.followUpDueProspects}</strong>
          </div>
          <div className="metric">
            <span>Paid Campaigns</span>
            <strong>{cycleStatus.funnel.paidPromotionCampaigns}</strong>
          </div>
          <div className="metric">
            <span>Promo Verification</span>
            <strong>{cycleStatus.funnel.paidPromotionsAwaitingVerification}</strong>
          </div>
          <div className="metric">
            <span>Promo Measurement</span>
            <strong>{cycleStatus.funnel.paidPromotionsAwaitingConversion}</strong>
          </div>
          <div className="metric">
            <span>Approved Posts</span>
            <strong>{cycleStatus.social.approvedPosts}</strong>
          </div>
          <div className="metric">
            <span>Ready Posts</span>
            <strong>{cycleStatus.social.readyForReviewPosts}</strong>
          </div>
        </div>
        <div className="notice">
          <strong>Next Action</strong>
          <span>{cycleStatus.nextAction}</span>
        </div>
        <div className="warning-list">
          {cycleStatus.blockers.map((blocker) => (
            <div className="proof-block" key={blocker}>
              <span>blocker</span>
              <strong>{blocker}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Revenue Execution Brief</h2>
          <p>{revenueExecutionBrief.nextAction}</p>
        </div>
        <div className="notice">
          <strong>Public Brief</strong>
          <span>
            Generated {revenueExecutionBrief.generatedAtUtc}.{' '}
            <a href={publicPath('/revenue-execution-brief.json')}>JSON</a> ·{' '}
            <a href={publicPath('/revenue-execution-brief.md')}>Markdown</a> · run{' '}
            <code>npm run ops:execution-brief-write</code> after state changes.
          </span>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Brief Actions</span>
            <strong>{revenueExecutionBrief.topActions.length}</strong>
          </div>
          <div className="metric">
            <span>Brief Confirmed Reserve</span>
            <strong>{revenueExecutionBrief.northStar.confirmedSats} sats</strong>
          </div>
          <div className="metric">
            <span>Brief Remaining</span>
            <strong>{revenueExecutionBrief.northStar.remainingSats} sats</strong>
          </div>
        </div>
        <div className="warning-list">
          {revenueExecutionActions.map((action, index) => (
            <div className="proof-block" key={action.id}>
              <span>
                Brief {index + 1} {action.type}
              </span>
              <strong>{action.objective}</strong>
              <p>{action.whyItCanCreateSats}</p>
              <div className="command-list">
                <span>Evidence Required</span>
                <code>{action.evidenceRequired}</code>
                <span>Stop Rule</span>
                <code>{action.stopRule}</code>
                <span>Command</span>
                <code>{action.command}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Target Math</h2>
          <p>Planning math for the 1,000,000,000 sats reserve target.</p>
        </div>
        <div className="notice">
          <strong>Assumption</strong>
          <span>
            BTC/USD {btcUsdPlanningAssumption.toLocaleString('en-US')}; {reserveAllocationPercent}%
            of post-receipt revenue allocated to reserve. Actual sats are recorded only after
            confirmed receipt or approved allocation.
          </span>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Next Milestone Gap</span>
            <strong>{nextMilestoneAdditionalSats.toString()} sats</strong>
          </div>
          <div className="metric">
            <span>Full Target Gap</span>
            <strong>{remainingSats.toString()} sats</strong>
          </div>
          <div className="metric">
            <span>Terminal Plan</span>
            <strong>npm run ops:sats-target-markdown</strong>
          </div>
          <div className="metric">
            <span>Ready Outreach Value</span>
            <strong>${manualOutreachQualifiedRevenueUsd.toLocaleString('en-US')}</strong>
          </div>
          <div className="metric">
            <span>Ready Outreach Reserve Sats</span>
            <strong>{manualOutreachReserveSats.toString()} sats</strong>
          </div>
          <div className="metric">
            <span>Next Milestone Coverage</span>
            <strong>{nextMilestoneCoverage}%</strong>
          </div>
          <div className="metric">
            <span>Close Rate Needed</span>
            <strong>{nextMilestoneCloseRate}%</strong>
          </div>
        </div>
        <div className="warning-list">
          {targetScenarios.map((scenario) => (
            <div className="proof-block" key={scenario.id}>
              <span>${scenario.priceUsd}</span>
              <strong>{scenario.label}</strong>
              <div className="command-list">
                <span>Planning Sats Per Deal</span>
                <code>{scenario.reserveSatsPerDeal}</code>
                <span>Deals To 1M Sats</span>
                <code>{scenario.dealsToNextMilestone}</code>
                <span>Deals To 1B Sats</span>
                <code>{scenario.dealsToFullTarget}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Attribution Links</h2>
          <p>Tracked URLs for measuring paid promotion and outreach conversion.</p>
        </div>
        <div className="notice">
          <strong>Terminal Plan</strong>
          <span>Run npm run ops:attribution-markdown for the full tracked-link packet.</span>
        </div>
        <div className="warning-list">
          {paidAttributionLinks.map((link) => (
            <div className="proof-block" key={link.id}>
              <span>paid-promotion</span>
              <strong>
                {link.id} @{link.promoter}
              </strong>
              <p>
                Current reported posts are untracked unless platform analytics, replies, invoice
                requests, or receipts are recorded.
              </p>
              <div className="command-list">
                <span>Transparency URL</span>
                <code>{link.transparencyUrl}</code>
                <span>Service URL</span>
                <code>{link.serviceUrl}</code>
              </div>
            </div>
          ))}
          {outreachAttributionLinks.map((link) => (
            <div className="proof-block" key={link.packetId}>
              <span>manual-outreach</span>
              <strong>{link.prospectId}</strong>
              <code>{link.packetId}</code>
              <div className="command-list">
                <span>Service URL</span>
                <code>{link.serviceUrl}</code>
                <span>Transparency URL</span>
                <code>{link.transparencyUrl}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Inbound Lead Capture</h2>
          <p>Record replies and DMs from live attention without bypassing invoice approval.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Live Sources</span>
            <strong>{inboundSources.length}</strong>
          </div>
          <div className="metric">
            <span>Open Inbound Leads</span>
            <strong>{inboundLeads.length}</strong>
          </div>
          <div className="metric">
            <span>Invoice Requests Needing Review</span>
            <strong>{inboundInvoiceRequests.length}</strong>
          </div>
        </div>
        <div className="notice">
          <strong>Terminal Plan</strong>
          <span>Run npm run ops:inbound-lead-plan for live sources and compliant reply copy.</span>
        </div>
        <div className="warning-list">
          {inboundLeadQueue.replyTemplates.map((template) => (
            <div className="proof-block" key={template.id}>
              <span>{template.id}</span>
              <strong>{template.purpose}</strong>
              <pre className="preview">{template.text}</pre>
            </div>
          ))}
          {inboundSources.slice(0, 5).map((source) => (
            <div className="proof-block" key={`${source.type}-${source.id}`}>
              <span>{source.type}</span>
              <strong>{source.label}</strong>
              <code>{source.url}</code>
              <div className="command-list">
                <span>Record Inbound Lead</span>
                <code>{recordInboundLeadCommand(source)}</code>
              </div>
            </div>
          ))}
          {inboundSources.length === 0 ? (
            <div className="proof-block">
              <span>waiting</span>
              <strong>No live attribution source is ready for inbound lead capture.</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Inbound Invoice Requests</h2>
          <p>Turn explicit inbound invoice demand into quote inputs for chairman review.</p>
        </div>
        <div className="warning-list">
          {inboundInvoiceRequests.length === 0 ? (
            <div className="proof-block">
              <span>waiting</span>
              <strong>No inbound invoice requests are waiting for chairman review.</strong>
              <p>
                Record interested replies with customerAskedForInvoice true only when the customer
                explicitly asks for an invoice.
              </p>
              <div className="command-list">
                <span>Plan Command</span>
                <code>npm run ops:inbound-invoice-request-plan</code>
                <span>Boundary</span>
                <code>
                  No exact-sats invoice or payment instruction before Executive Chairman approval.
                </code>
              </div>
            </div>
          ) : null}
          {inboundInvoiceRequests.map((lead) => (
            <div className="proof-block" key={lead.id}>
              <span>{lead.requestedOfferId}</span>
              <strong>{lead.contactHandle}</strong>
              <p>{lead.projectUrl}</p>
              <div className="command-list">
                <span>Evidence</span>
                <code>{lead.evidence}</code>
                <span>Render Chairman Packet</span>
                <code>{renderInboundInvoiceRequestCommand(lead)}</code>
                <span>Boundary</span>
                <code>
                  No exact-sats invoice or payment instruction before Executive Chairman approval.
                </code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Priority Action Queue</h2>
          <p>Executable revenue-cycle actions, ordered by current operating priority.</p>
        </div>
        <div className="warning-list">
          {actionQueue.map((action) => (
            <div className="proof-block" key={action.id}>
              <span>
                #{action.priority} {action.type}
              </span>
              <strong>{action.title}</strong>
              <p>{action.boundary}</p>
              <div className="command-list">
                <span>Required Actor</span>
                <code>{action.requiredActor}</code>
                <span>Evidence Required</span>
                <code>{action.evidenceRequired}</code>
                {action.artifact ? (
                  <>
                    <span>Artifact</span>
                    <code>
                      <a href={publicArtifactPath(action.artifact)}>{action.artifact}</a>
                    </code>
                  </>
                ) : null}
                <span>Command</span>
                <code>{action.command}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Social Review Queue</h2>
          <p>Ready posts require chairman approval before approved-only automation can publish.</p>
        </div>
        <div className="warning-list">
          {socialPostsReadyForReview.length === 0 ? (
            <div className="proof-block">
              <span>clear</span>
              <strong>No social posts are waiting for chairman review.</strong>
            </div>
          ) : (
            socialPostsReadyForReview.map((post) => (
              <div className="proof-block" key={post.id}>
                <span>{post.type}</span>
                <strong>{post.id}</strong>
                <pre className="preview">{post.text}</pre>
                <div className="command-list">
                  <span>Approve</span>
                  <code>{approveSocialPostCommand(post)}</code>
                  <span>Reject</span>
                  <code>{rejectSocialPostCommand(post)}</code>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Approved Social Publishing Queue</h2>
          <p>Approved posts waiting for manual publication or approved-only X credentials.</p>
        </div>
        <div className="warning-list">
          {approvedSocialPosts.length === 0 ? (
            <div className="proof-block">
              <span>clear</span>
              <strong>No approved social posts are waiting for publication.</strong>
            </div>
          ) : (
            approvedSocialPosts.slice(0, 5).map((post) => (
              <div className="proof-block" key={post.id}>
                <span>{post.type}</span>
                <strong>{post.id}</strong>
                <pre className="preview">{post.text}</pre>
                <div className="command-list">
                  <span>Record Published URL</span>
                  <code>{recordPublishedSocialPostCommand(post)}</code>
                </div>
              </div>
            ))
          )}
          {approvedSocialPosts.length > 5 ? (
            <div className="notice">
              <strong>Backlog</strong>
              <span>{approvedSocialPosts.length - 5} additional approved posts are queued.</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Settlement Options Brief</h2>
          <p>{settlementOptionsBrief.nextAction}</p>
        </div>
        <div className="notice">
          <strong>Public Brief</strong>
          <span>
            Generated {settlementOptionsBrief.generatedAtUtc}.{' '}
            <a href={publicPath('/settlement-options-brief.json')}>JSON</a> .{' '}
            <a href={publicPath('/settlement-options-brief.md')}>Markdown</a> . run{' '}
            <code>npm run ops:settlement-options-write</code> after state changes.
          </span>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Direct Reserve Path</span>
            <strong>{settlementOptionsBrief.directReservePath.settlementCurrency}</strong>
          </div>
          <div className="metric">
            <span>Direct Path Status</span>
            <strong>{settlementOptionsBrief.directReservePath.status}</strong>
          </div>
          <div className="metric">
            <span>Alternative Paths</span>
            <strong>{settlementOptionsBrief.alternativeSettlementPaths.length}</strong>
          </div>
          <div className="metric">
            <span>Invoice Templates</span>
            <strong>{settlementOptionsBrief.directReservePath.supportedOffers.length}</strong>
          </div>
        </div>
        <div className="notice">
          <strong>Payment Address Policy</strong>
          <span>{settlementOptionsBrief.directReservePath.paymentAddressPolicy}</span>
        </div>
        <div className="warning-list">
          {settlementOptionsBrief.directReservePath.supportedOffers.map((offer) => (
            <div className="proof-block" key={offer.offerId}>
              <span>BTC invoice template</span>
              <strong>{offer.offerId}</strong>
              <p>{offer.label}</p>
              <div className="command-list">
                <span>USD Price</span>
                <code>${offer.priceUsd}</code>
                <span>Template Ready</span>
                <code>{String(offer.hasTemplate)}</code>
                <span>Quote Draft</span>
                <code>{offer.quoteCommand}</code>
              </div>
            </div>
          ))}
          {settlementOptionsBrief.alternativeSettlementPaths.map((option) => (
            <div className="proof-block" key={option.settlementCurrency}>
              <span>planning only</span>
              <strong>{option.settlementCurrency}</strong>
              <p>{option.customerReply}</p>
              <div className="command-list">
                <span>Status</span>
                <code>{option.status}</code>
                <span>Stop Rule</span>
                <code>{option.stopRule}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Social Dispatch Brief</h2>
          <p>{socialDispatchBrief.nextAction}</p>
        </div>
        <div className="notice">
          <strong>Public Brief</strong>
          <span>
            Generated {socialDispatchBrief.generatedAtUtc}.{' '}
            <a href={publicPath('/social-dispatch-brief.json')}>JSON</a> .{' '}
            <a href={publicPath('/social-dispatch-brief.md')}>Markdown</a> . run{' '}
            <code>npm run ops:social-dispatch-write</code> after state changes.
          </span>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Approved Posts</span>
            <strong>{socialDispatchBrief.counts.approved}</strong>
          </div>
          <div className="metric">
            <span>Dispatch Batch</span>
            <strong>{socialDispatchBrief.readyManualPosts.length}</strong>
          </div>
          <div className="metric">
            <span>Backlog</span>
            <strong>{socialDispatchBrief.queuedRemainderCount}</strong>
          </div>
          <div className="metric">
            <span>Live Posting Enabled</span>
            <strong>{String(socialDispatchBrief.livePostingEnabled)}</strong>
          </div>
        </div>
        <div className="warning-list">
          {socialDispatchBrief.readyManualPosts.map((post) => (
            <div className="proof-block" key={post.id}>
              <span>{post.type}</span>
              <strong>{post.id}</strong>
              <pre className="preview">{post.text}</pre>
              <div className="command-list">
                <span>Approved Content SHA-256</span>
                <code>{post.contentSha256}</code>
                <span>Evidence Intake</span>
                <code>
                  <a href={post.evidenceIssueUrl}>{post.evidenceIssueUrl}</a>
                </code>
                <span>Record Published URL</span>
                <code>{post.recordPublishedCommand}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Paid Promotion Control</h2>
          <p>Disclosed promotion experiments must be verified and measured before repeat spend.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Total Campaigns</span>
            <strong>{paidPromotionLedger.campaigns.length}</strong>
          </div>
          <div className="metric">
            <span>Awaiting Verification</span>
            <strong>{paidPromotionsAwaitingVerification.length}</strong>
          </div>
          <div className="metric">
            <span>Awaiting 24h Measurement</span>
            <strong>{liveVerifiedPaidPromotions.length}</strong>
          </div>
          <div className="metric">
            <span>Confirmed Promo Receipts</span>
            <strong>
              {paidPromotionLedger.campaigns
                .reduce(
                  (total, campaign) => total + BigInt(campaign.conversion.confirmedReceiptsSats),
                  0n
                )
                .toString()}{' '}
              sats
            </strong>
          </div>
        </div>
        <div className="warning-list">
          {paidPromotionLedger.campaigns.map((campaign) => (
            <div className="proof-block" key={campaign.id}>
              <span>{campaign.status}</span>
              <strong>
                {campaign.promoter.displayName} @{campaign.promoter.handle}
              </strong>
              <code>{campaign.id}</code>
              <p>{campaign.nextAction}</p>
              <div className="command-list">
                <span>Reported Post</span>
                <code>{campaign.reportedPostUrl}</code>
                <span>Compensation</span>
                <code>
                  {campaign.compensation.amountUsd} USD {campaign.compensation.asset} on{' '}
                  {campaign.compensation.network}
                </code>
                <span>Verification</span>
                <code>{campaign.verification.status}</code>
                {campaign.status === 'live-verified' ? (
                  <>
                    <span>Record 24h Conversion</span>
                    <code>{recordPaidPromotionConversionCommand(campaign)}</code>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Referral Handoff Queue</h2>
          <p>
            Completed zero-receipt promotion can become post-receipt referral flow without repeat
            upfront spend.
          </p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Handoff Candidates</span>
            <strong>{referralHandoffCandidates.length}</strong>
          </div>
          <div className="metric">
            <span>Active Handoffs</span>
            <strong>{activeReferralHandoffs.length}</strong>
          </div>
          <div className="metric">
            <span>Awaiting Response</span>
            <strong>
              {
                activeReferralHandoffs.filter(
                  (handoff) => handoff.status === 'sent-awaiting-response'
                ).length
              }
            </strong>
          </div>
          <div className="metric">
            <span>Accepted Awaiting Lead</span>
            <strong>
              {
                activeReferralHandoffs.filter(
                  (handoff) => handoff.status === 'accepted-awaiting-referred-lead'
                ).length
              }
            </strong>
          </div>
        </div>
        <div className="notice">
          <strong>Boundary</strong>
          <span>{referralPartnerHandoffQueue.boundary}</span>
        </div>
        <div className="warning-list">
          {referralHandoffCandidates.map((campaign) => (
            <div className="proof-block" key={`handoff-candidate-${campaign.id}`}>
              <span>post-receipt candidate</span>
              <strong>
                {campaign.promoter.displayName} @{campaign.promoter.handle}
              </strong>
              <p>{campaign.nextAction}</p>
              <div className="command-list">
                <span>Source Post</span>
                <code>{campaign.verifiedPostUrl ?? campaign.reportedPostUrl}</code>
                <span>Write Packet</span>
                <code>{writeReferralHandoffPacketCommand(campaign)}</code>
                <span>Packet Artifact</span>
                <code>
                  <a href={publicPath('/referral-partner-handoff-packet.md')}>
                    public/referral-partner-handoff-packet.md
                  </a>
                </code>
                <span>Render Terms</span>
                <code>{renderReferralHandoffCommand(campaign)}</code>
                <span>Record Sent Evidence</span>
                <code>{recordReferralHandoffSentCommand(campaign)}</code>
              </div>
            </div>
          ))}
          {activeReferralHandoffs.map((handoff) => (
            <div className="proof-block" key={handoff.id}>
              <span>{handoff.status}</span>
              <strong>
                {handoff.partner.displayName} @{handoff.partner.handle}
              </strong>
              <p>{handoff.nextAction}</p>
              <div className="command-list">
                <span>Source Evidence</span>
                <code>{handoff.sourceEvidence}</code>
                <span>Sent Evidence</span>
                <code>{handoff.sentEvidence}</code>
                {handoff.status === 'sent-awaiting-response' ? (
                  <>
                    <span>Record Response</span>
                    <code>{recordReferralHandoffResponseCommand(handoff)}</code>
                  </>
                ) : null}
                {handoff.status === 'accepted-awaiting-referred-lead' ? (
                  <>
                    <span>Record Referred Lead</span>
                    <code>{recordReferralLeadCommand(handoff)}</code>
                  </>
                ) : null}
              </div>
            </div>
          ))}
          {referralHandoffCandidates.length === 0 && activeReferralHandoffs.length === 0 ? (
            <div className="proof-block">
              <span>clear</span>
              <strong>No referral handoff is waiting on evidence.</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Referral Partner Policy</h2>
          <p>{referralPolicySummary()}</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Status</span>
            <strong>{referralPartnerPolicy.status}</strong>
          </div>
          <div className="metric">
            <span>Max Referral Share</span>
            <strong>
              {
                referralPartnerPolicy.compensationModel
                  .maximumReferralSharePercentOfNetServiceRevenue
              }
              %
            </strong>
          </div>
          <div className="metric">
            <span>Payment Trigger</span>
            <strong>{referralPartnerPolicy.compensationModel.paymentTrigger}</strong>
          </div>
        </div>
        <div className="warning-list">
          <div className="proof-block">
            <span>{referralPartnerPolicy.mode}</span>
            <strong>{referralPartnerPolicy.approvalItemId}</strong>
            <p>{referralPartnerPolicy.nextAction}</p>
            <pre className="preview">{referralPartnerPolicy.partnerReplyTemplate}</pre>
            <div className="command-list">
              <span>Public Partner Page</span>
              <code>{PUBLIC_BASE_URL}/partners/referrals</code>
              <span>Policy Check</span>
              <code>npm run ops:referral-policy-check</code>
              <span>Partner Packet</span>
              <code>{referralPartnerPacketCommand()}</code>
              {referralPolicyApprovalItem ? (
                <>
                  <span>Approve</span>
                  <code>{approvalCommand(referralPolicyApprovalItem)}</code>
                  <span>Reject</span>
                  <code>{rejectionCommand(referralPolicyApprovalItem)}</code>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Approval Queue</h2>
          <p>Current proposal states from the public executive approval queue.</p>
        </div>
        <div className="summary-grid">
          {Object.entries(approvalCounts).map(([status, count]) => (
            <div className="metric" key={status}>
              <span>{status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <div className="warning-list">
          {reviewItems.map((item) => (
            <div className="proof-block" key={item.id}>
              <span>{item.category}</span>
              <strong>{item.title}</strong>
              <code>{item.id}</code>
              <p>{item.proposedAction}</p>
              <div className="command-list">
                <span>Approve</span>
                <code>{approvalCommand(item)}</code>
                <span>Reject</span>
                <code>{rejectionCommand(item)}</code>
                <span>After approval</span>
                <code>{nextCommandAfterApproval(item, reviewBatch)}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Manual Outreach Packets</h2>
          <p>Current five-packet dispatch sprint waiting for human send and contact evidence.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Sprint Gross Target</span>
            <strong>${outreachDispatchGrossRevenueUsd.toLocaleString('en-US')}</strong>
          </div>
          <div className="metric">
            <span>Qualified Gross Path</span>
            <strong>${outreachDispatchQualifiedGrossRevenueUsd.toLocaleString('en-US')}</strong>
          </div>
          <div className="metric">
            <span>Reserve Allocation Target</span>
            <strong>
              ${outreachDispatchReserveUsd.toLocaleString('en-US')} at{' '}
              {outreachDispatchReserveAllocationPercent}%
            </strong>
          </div>
          <div className="metric">
            <span>Qualified Reserve Path</span>
            <strong>
              ${outreachDispatchQualifiedReserveUsd.toLocaleString('en-US')} at{' '}
              {outreachDispatchReserveAllocationPercent}%
            </strong>
          </div>
          <div className="metric">
            <span>Planning Reserve Impact</span>
            <strong>{outreachDispatchReserveSatsAtPlanningRate.toString()} sats</strong>
          </div>
          <div className="metric">
            <span>Qualified Planning Impact</span>
            <strong>{outreachDispatchQualifiedReserveSatsAtPlanningRate.toString()} sats</strong>
          </div>
        </div>
        <div className="notice">
          <strong>Dispatch Sprint</strong>
          <span>
            Showing {outreachDispatchSprint.length} of {outreachDispatchBrief.readyManualSendCount}{' '}
            ready packets. Backlog after this sprint: {outreachDispatchRemainder}.{' '}
            <a href={publicPath('/outreach-dispatch-brief.json')}>JSON</a> ·{' '}
            <a href={publicPath('/outreach-dispatch-brief.md')}>Markdown</a> · run{' '}
            <code>npm run ops:outreach-dispatch-write</code> after state changes.
          </span>
        </div>
        <div className="notice">
          <strong>First Conversion Goal</strong>
          <span>{outreachDispatchBrief.sprintEconomics.firstConversionGoal}</span>
        </div>
        <div className="warning-list">
          {outreachDispatchSprint.map((packet) => (
            <div className="proof-block" key={packet.packetId}>
              <span>{packet.offerId}</span>
              <strong>{packet.prospectId}</strong>
              <code>{packet.packetId}</code>
              <code>{packet.trackingLabel}</code>
              <p>{outreachDispatchBrief.dispatchRule}</p>
              <div className="command-list">
                <span>Current Approved Ask</span>
                <code>
                  {packet.currentOfferId} / ${packet.currentAskUsd}
                </code>
                <span>Qualified Revenue Path</span>
                <code>${packet.qualifiedRevenueUsd}</code>
                {packet.conversionPlan ? (
                  <>
                    <span>Upgrade Gate</span>
                    <code>
                      {packet.conversionPlan.upgradeOfferId} only after explicit fit
                    </code>
                  </>
                ) : null}
              </div>
              <pre className="preview">{packet.message}</pre>
              <div className="command-list">
                <span>Record Contact</span>
                <code>{withSentAtUtcPlaceholder(packet.recordContactCommand)}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Reply Conversion</h2>
          <p>Evidence commands for turning approved outreach into invoice-ready revenue records.</p>
        </div>
        <div className="notice">
          <strong>Public Brief</strong>
          <span>
            Generated {replyConversionBrief.generatedAtUtc}.{' '}
            <a href={publicPath('/reply-conversion-brief.json')}>JSON</a> ·{' '}
            <a href={publicPath('/reply-conversion-brief.md')}>Markdown</a> · run{' '}
            <code>npm run ops:reply-conversion-write</code> after reply-state changes.
          </span>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Outreach Approved</span>
            <strong>{replyConversionBrief.counts.outreachApprovedProspects}</strong>
          </div>
          <div className="metric">
            <span>Sent Outreach Packets</span>
            <strong>{replyConversionBrief.counts.sentOutreachPackets}</strong>
          </div>
          <div className="metric">
            <span>Contacted Prospects</span>
            <strong>{replyConversionBrief.counts.contactedProspects}</strong>
          </div>
          <div className="metric">
            <span>Invoice Requests</span>
            <strong>{replyConversionBrief.counts.invoiceRequestedProspects}</strong>
          </div>
          <div className="metric">
            <span>Inbound Invoice Requests</span>
            <strong>{replyConversionBrief.counts.inboundInvoiceRequests}</strong>
          </div>
        </div>
        <div className="notice">
          <strong>Reply Next Action</strong>
          <span>
            {replyConversionBrief.nextAction} Submit manual send evidence through{' '}
            <a href={CONTACT_EVIDENCE_INTAKE_URL}>the contact evidence form</a>.
          </span>
        </div>
        <div className="warning-list">
          {replyConversionBrief.stopRules.map((rule) => (
            <div className="proof-block" key={rule}>
              <span>stop rule</span>
              <strong>{rule}</strong>
            </div>
          ))}
          {outreachApprovedProspects.map((prospect) => (
            <div className="proof-block" key={`contact-${prospect.id}`}>
              <span>after approved outreach is sent</span>
              <strong>{prospect.id}</strong>
              <p>Record durable contact evidence before treating the prospect as contacted.</p>
              <div className="command-list">
                <span>Record Contacted</span>
                <code>{recordContactedCommand(prospect)}</code>
              </div>
            </div>
          ))}
          {contactedProspects.map((prospect) => (
            <div className="proof-block" key={`invoice-request-${prospect.id}`}>
              <span>after customer asks for invoice</span>
              <strong>{prospect.id}</strong>
              <p>Record the customer invoice request before preparing exact-sats quote inputs.</p>
              <div className="command-list">
                <span>Record Invoice Request</span>
                <code>{recordInvoiceRequestCommand(prospect)}</code>
              </div>
            </div>
          ))}
          {invoiceRequestedProspects.map((prospect) => (
            <div className="proof-block" key={`quote-${prospect.id}`}>
              <span>invoice request recorded</span>
              <strong>{prospect.id}</strong>
              <p>Prepare quote inputs, then submit the exact-sats invoice for chairman approval.</p>
              <div className="command-list">
                <span>Quote Plan</span>
                <code>npm run ops:invoice-quote-plan</code>
                <span>Invoice Request Packet</span>
                <code>
                  node scripts/sats-invoice-request-agent.mjs render --prospect {prospect.id}
                </code>
              </div>
            </div>
          ))}
          {contactedProspects.length === 0 && invoiceRequestedProspects.length === 0 ? (
            <div className="notice">
              <strong>Current Reply State</strong>
              <span>No contacted prospects or invoice requests are recorded yet.</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Prospect Pipeline</h2>
          <p>
            Evidence-backed candidates remain blocked until chairman review and later outreach
            approval.
          </p>
        </div>
        <div className="summary-grid">
          {Object.entries(prospectCounts).map(([stage, count]) => (
            <div className="metric" key={stage}>
              <span>{stage}</span>
              <strong>{count}</strong>
            </div>
          ))}
          <div className="metric">
            <span>Candidate Intake</span>
            <strong>
              <a href={prospectPipeline.prospectIntakeUrl}>GitHub issue form</a>
            </strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Chairman Review Prospects</h2>
          <p>
            Approved for prospect review only. Outreach still requires a separate explicit decision.
          </p>
        </div>
        <div className="warning-list">
          {chairmanReviewProspects.map((prospect) => (
            <div className="proof-block" key={prospect.id}>
              <span>{prospect.recommendedOfferId}</span>
              <strong>{prospect.id}</strong>
              <p>{prospect.observedClaim}</p>
              <code>{prospect.stageApprovalId}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Next Review Batch</h2>
          <p>First candidates selected by the prospect review packet command.</p>
        </div>
        <div className="warning-list">
          {reviewBatch.map((prospect) => (
            <div className="proof-block" key={prospect.id}>
              <span>{prospect.recommendedOfferId}</span>
              <strong>{prospect.id}</strong>
              <p>{prospect.observedClaim}</p>
              <code>{prospect.projectUrl}</code>
            </div>
          ))}
        </div>
        <div className="notice">
          <strong>Command</strong>
          <span>
            Run <code>npm run ops:prospect-review-plan</code> for the machine-readable packet, then
            approve or reject through the public approval queue process.
          </span>
        </div>
      </section>

      <section className="public-band">
        <div className="notice">
          <strong>Boundary</strong>
          <span>
            No price guarantee, redemption promise, revenue guarantee, market-support commitment, or
            autonomous asset movement. Public reports:
            <a href={`${PUBLIC_BASE_URL}/transparency/latest.json`}> latest.json</a>
          </span>
        </div>
      </section>
    </main>
  );
}
