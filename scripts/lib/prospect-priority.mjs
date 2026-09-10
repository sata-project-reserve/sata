const SIGNALS = [
  {
    id: 'setup-intent',
    weight: 24,
    label: 'public reporting/setup intent',
    pattern: /\b(report|reporting|dashboard|workflow|github|docs|documentation|whitepaper|public json|proof page)\b/i
  },
  {
    id: 'reserve-custody',
    weight: 18,
    label: 'reserve, treasury, custody, or multisig claims',
    pattern: /\b(reserve|treasury|btc|bitcoin|custody|multisig|wallet map|escrow)\b/i
  },
  {
    id: 'authority-liquidity',
    weight: 12,
    label: 'authority or liquidity claims',
    pattern: /\b(authority|revoked|freeze|mint|liquidity|lp lock|locked liquidity|burned liquidity|burn)\b/i
  },
  {
    id: 'tooling-platform',
    weight: 10,
    label: 'tooling, launchpad, or platform fit',
    pattern: /\b(tool|tooling|launchpad|service|platform|clients|screening|non-custodial)\b/i
  }
];

export function prioritizeOutreachPackets({ packets, prospectPipeline, revenuePlan }) {
  const prospects = new Map(
    (prospectPipeline?.prospects ?? []).map((prospect) => [prospect.id, prospect])
  );
  return [...(packets ?? [])]
    .map((packet) => {
      const prospect = prospects.get(packet.prospectId);
      const targetRevenueUsd = cleanLine(
        packet.targetRevenueUsd ??
          offerPriceUsd({
            revenuePlan,
            offerId: packet.offerId ?? prospect?.recommendedOfferId
          })
      );
      const qualifiedRevenueUsd = bestAvailableOfferPriceUsd({
        revenuePlan,
        values: [targetRevenueUsd],
        offerIds: [packet.offerId, prospect?.recommendedOfferId]
      });
      const priority = scoreProspectForOutreach({
        prospect,
        packet,
        revenuePlan,
        targetRevenueUsd,
        qualifiedRevenueUsd
      });
      return { ...packet, qualifiedRevenueUsd, priority };
    })
    .sort((left, right) => {
      const byScore = right.priority.score - left.priority.score;
      if (byScore !== 0) return byScore;
      const byRevenue =
        Number(right.qualifiedRevenueUsd ?? right.targetRevenueUsd ?? 0) -
        Number(left.qualifiedRevenueUsd ?? left.targetRevenueUsd ?? 0);
      if (byRevenue !== 0) return byRevenue;
      return String(left.packetId ?? left.id).localeCompare(String(right.packetId ?? right.id));
    });
}

export function scoreProspectForOutreach({
  prospect,
  packet,
  revenuePlan,
  targetRevenueUsd,
  qualifiedRevenueUsd
}) {
  const reasons = [];
  const packetOfferId = cleanLine(packet?.offerId);
  const recommendedOfferId = cleanLine(prospect?.recommendedOfferId);
  const offerId = packetOfferId || recommendedOfferId;
  const revenue = Number(targetRevenueUsd ?? 0);
  const qualifiedRevenue = Number(qualifiedRevenueUsd ?? targetRevenueUsd ?? 0);
  let score = Math.min(Math.max(Math.floor(Math.max(revenue, qualifiedRevenue) / 5), 0), 40);
  if (revenue > 0) reasons.push(`current offer value $${revenue}`);
  if (recommendedOfferId && recommendedOfferId !== packetOfferId) {
    const recommendedRevenue = Number(offerPriceUsd({ revenuePlan, offerId: recommendedOfferId }));
    if (recommendedRevenue > revenue) {
      reasons.push(`qualified upgrade path $${recommendedRevenue}`);
    }
  }
  if ([offerId, recommendedOfferId].includes('transparency-report-setup')) {
    score += 14;
    reasons.push('setup offer has higher reserve-sats leverage');
  }
  if ([offerId, recommendedOfferId].includes('full-proof-dashboard')) {
    score += 24;
    reasons.push('dashboard offer has highest reserve-sats leverage');
  }

  const text = [
    prospect?.observedClaim,
    prospect?.notes,
    ...(Array.isArray(prospect?.evidence) ? prospect.evidence : [])
  ].join('\n');
  for (const signal of SIGNALS) {
    if (signal.pattern.test(text)) {
      score += signal.weight;
      reasons.push(signal.label);
    }
  }
  const evidenceCount = Array.isArray(prospect?.evidence) ? prospect.evidence.length : 0;
  if (evidenceCount > 1) {
    score += 4;
    reasons.push('multiple public evidence links');
  }
  if (/^https?:\/\//i.test(prospect?.projectUrl ?? packet?.destination?.projectUrl ?? '')) {
    score += 4;
    reasons.push('direct public project URL');
  }
  if (prospect?.chairmanApprovedBeforeOutreach === true) {
    score += 6;
    reasons.push('chairman-approved outreach path');
  }

  return {
    score,
    tier: score >= 76 ? 'hot' : score >= 54 ? 'warm' : 'standard',
    reasons
  };
}

function offerPriceUsd({ revenuePlan, offerId }) {
  const stream = (revenuePlan?.revenueStreams ?? []).find((item) => item.id === offerId);
  return stream?.priceUsd ?? '0';
}

function bestAvailableOfferPriceUsd({ revenuePlan, offerIds, values = [] }) {
  return [
    ...values.map((value) => Number(value)),
    ...offerIds.map((offerId) =>
      Number(offerPriceUsd({ revenuePlan, offerId: cleanLine(offerId) }))
    )
  ]
    .filter((price) => Number.isFinite(price))
    .reduce((best, price) => Math.max(best, price), 0)
    .toString();
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
