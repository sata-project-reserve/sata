export function buildLiveReplySources({ paidPromotionLedger, socialQueue }) {
  return [
    ...(paidPromotionLedger.campaigns ?? [])
      .filter((campaign) => ['live-verified', 'completed'].includes(campaign.status))
      .map((campaign) => ({
        type: 'paid-promotion-reply',
        id: campaign.id,
        url: campaign.verifiedPostUrl ?? campaign.reportedPostUrl ?? campaign.promoter?.profileUrl,
        label: `Paid promotion from @${campaign.promoter?.handle}`,
        triageCommand: `node scripts/inbound-reply-triage-agent.mjs markdown --sourceType paid-promotion-reply --sourceId ${campaign.id} --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"`
      })),
    ...(socialQueue.posts ?? [])
      .filter((post) => post.status === 'published')
      .map((post) => ({
        type: 'published-social-reply',
        id: post.id,
        url: post.postUrl,
        label: `Published @${socialQueue.account?.handle} post ${post.id}`,
        triageCommand: `node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId ${post.id} --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"`
      }))
  ].filter((source) => source.url);
}
