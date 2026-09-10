import { buildAuditIntakeDraft } from './audit-intake-parser.mjs';

export function buildTransparencyAuditArtifact({ issue, deliveryKit, prospectPipeline, invoiceQueue }) {
  const draft = buildAuditIntakeDraft({ issue, deliveryKit, prospectPipeline, invoiceQueue });
  const lines = [
    `# ${draft.deliveryDraft.title}`,
    '',
    'Status: Draft prepared from client intake. Not final until reviewed and approved.',
    '',
    'Attribution and public release require Executive Chairman approval.',
    '',
    '## Required Disclosures',
    '',
    ...deliveryKit.deliverableTemplate.requiredDisclosures.map((disclosure) => `- ${disclosure}`),
    '',
    '## Client Intake Summary',
    '',
    `- Project: ${safeMarkdown(draft.intake.projectName)}`,
    `- Network: ${safeMarkdown(draft.intake.network)}`,
    `- Token or contract address: ${safeMarkdown(draft.intake.tokenOrContractAddress)}`,
    `- Public project URL: ${safeMarkdown(draft.intake.publicProjectUrl)}`,
    `- Public profile URL: ${safeMarkdown(draft.intake.publicProfileUrl)}`,
    `- Requested visibility: ${safeMarkdown(draft.intake.requestedDeliverableVisibility)}`,
    `- Payment status: ${safeMarkdown(draft.intake.paymentStatus)}`,
    '',
    '## Claims Requested For Review',
    '',
    blockValue(draft.intake.claimsToReview),
    '',
    '## Draft Review Sections',
    ''
  ];

  for (const section of deliveryKit.deliverableTemplate.sections) {
    lines.push(`### ${section}`, '', sectionBody(section, draft), '');
  }

  lines.push(
    '## Next Required Action',
    '',
    draft.nextRequiredAction,
    '',
    'No invoice, payment instruction, paid work, token grant, or public commitment is approved by this draft.'
  );

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function sectionBody(section, draft) {
  const evidence = evidenceItems(draft);
  const claims = String(draft.intake.claimsToReview ?? '');
  if (/Scope and limitations/i.test(section)) {
    return [
      '- Scope is limited to public evidence and client-provided evidence approved for citation.',
      '- Findings must separate verified, partially verified, and unverified claims.',
      '- This draft does not provide trading, legal, tax, or investment advice.'
    ].join('\n');
  }
  if (/Public inputs reviewed/i.test(section)) {
    return listValues([
      draft.prospectDraft.source.replace(/^github-issue:/, ''),
      draft.intake.publicProjectUrl,
      draft.intake.publicProfileUrl
    ]);
  }
  if (/Token authority review/i.test(section)) {
    return [
      `Review target: ${safeMarkdown(draft.intake.tokenOrContractAddress)}`,
      '',
      statusLine({
        label: 'Draft authority status',
        claimText: claims,
        patterns: [/mint/i, /freeze/i, /authority/i, /revok/i],
        evidence
      }),
      '- Required evidence: token or contract explorer page showing current mint/admin/freeze/owner permissions.',
      '- Delivery rule: label each authority claim verified only after the cited explorer or contract source shows the current permission state.'
    ].join('\n');
  }
  if (/Liquidity and lock evidence review/i.test(section)) {
    return [
      statusLine({
        label: 'Draft liquidity status',
        claimText: claims,
        patterns: [/liquidity/i, /\block/i, /\blp\b/i, /pool/i, /raydium/i],
        evidence
      }),
      '- Required evidence: pool address, LP token state, lock record, burn record, or locker page.',
      '- Delivery rule: describe liquidity as locked or removed from owner control only when the cited mechanism proves that exact current state.',
      '- Disclosure fix if evidence is missing: publish the pool address, lock transaction, locker program, unlock terms, and any remaining owner-controlled LP.'
    ].join('\n');
  }
  if (/Reserve or treasury claim review/i.test(section)) {
    return [
      statusLine({
        label: 'Draft reserve status',
        claimText: claims,
        patterns: [/reserve/i, /treasury/i, /btc/i, /bitcoin/i, /sat/i],
        evidence
      }),
      '- Required evidence: public reserve address, balance source, signed message or equivalent proof, and update cadence.',
      '- Delivery rule: reserve claims must be framed as disclosure, not a redemption promise, price floor, or market-support commitment.',
      '- Disclosure fix if evidence is missing: publish the reserve address, proof method, last verified timestamp, and explicit non-redemption caveat.'
    ].join('\n');
  }
  if (/Ownership and concentration disclosure review/i.test(section)) {
    return [
      statusLine({
        label: 'Draft ownership status',
        claimText: claims,
        patterns: [/owner/i, /holder/i, /allocation/i, /team/i, /treasury/i, /concentration/i, /supply/i],
        evidence
      }),
      '- Required evidence: holder distribution, team or treasury wallets, vesting or lock terms, and any wallets controlled by insiders.',
      '- Delivery rule: separate circulating supply, treasury supply, team supply, pool supply, and unknown outside supply when the data is available.',
      '- Disclosure fix if evidence is missing: publish a wallet-category table and mark unknown or owner-controlled balances plainly.'
    ].join('\n');
  }
  if (/Disclosure gaps/i.test(section)) {
    return disclosureGaps(draft, evidence);
  }
  if (/Risk language/i.test(section)) {
    return 'Required risk language: crypto assets can be volatile, liquidity can be thin, and this review is not financial advice.';
  }
  if (/Recommended fixes/i.test(section)) {
    return recommendedFixes(draft, evidence);
  }
  if (/Evidence links/i.test(section)) return listValues(draft.prospectDraft.evidence);
  return 'Section is available for reviewer notes after public evidence is checked.';
}

function evidenceItems(draft) {
  return compact([
    draft.prospectDraft.source.replace(/^github-issue:/, ''),
    draft.intake.tokenOrContractAddress,
    draft.intake.publicProjectUrl,
    draft.intake.publicProfileUrl,
    draft.intake.evidence,
    draft.intake.referralSource
  ]);
}

function statusLine({ label, claimText, patterns, evidence }) {
  const hasRelevantClaim = patterns.some((pattern) => pattern.test(claimText));
  const hasEvidence = evidence.length > 0;
  if (!hasRelevantClaim) {
    return `- ${label}: not specifically claimed in the intake; reviewer should still check public evidence before final delivery.`;
  }
  if (!hasEvidence) {
    return `- ${label}: unverified. The intake includes a relevant claim but no public evidence link was supplied.`;
  }
  return `- ${label}: pending verification against supplied public evidence. Do not mark verified until the reviewer records the exact citation.`;
}

function disclosureGaps(draft, evidence) {
  const gaps = [];
  if (!draft.intake.tokenOrContractAddress) {
    gaps.push('Token or contract address is missing; add the exact mint or contract address before review.');
  }
  if (evidence.length === 0) {
    gaps.push('No public evidence links were supplied; add explorer, pool, reserve, lock, repository, or official announcement links.');
  }
  if (!/no price|price guarantee|redemption|market-support|market support/i.test(draft.intake.claimsToReview ?? '')) {
    gaps.push('Risk caveats are not visible in the reviewed claims; add no price guarantee, no redemption promise, and no market-support commitment language.');
  }
  if (!/liquidity|lock|lp|pool/i.test(draft.intake.claimsToReview ?? '')) {
    gaps.push('Liquidity or lock status is not clearly stated; disclose whether liquidity exists, who controls LP, and whether any lock is independently verifiable.');
  }
  if (!/authority|mint|freeze|admin|owner/i.test(draft.intake.claimsToReview ?? '')) {
    gaps.push('Authority status is not clearly stated; disclose mint/admin/freeze/owner permissions or explain why the concept does not apply.');
  }
  if (gaps.length === 0) {
    gaps.push('No obvious intake-level disclosure gap was detected; reviewer must still confirm citations before final delivery.');
  }
  return gaps.map((gap) => `- ${safeMarkdown(gap)}`).join('\n');
}

function recommendedFixes(draft, evidence) {
  const fixes = [
    'Create a public proof page listing token or contract address, authority status, liquidity status, reserve claims, and last updated timestamp.',
    'Attach citations beside each factual claim instead of grouping evidence at the end.',
    'Add standard caveats: no price guarantee, no redemption promise, no market-support commitment, and not financial advice.'
  ];
  if (evidence.length > 0) {
    fixes.push('For final delivery, copy each supplied evidence link into the relevant section and record whether it verifies, partially verifies, or does not verify the claim.');
  }
  if (/liquidity|lock|lp|pool/i.test(draft.intake.claimsToReview ?? '')) {
    fixes.push('For liquidity claims, publish the pool address, LP owner or lock address, lock transaction, and unlock/removal conditions.');
  }
  if (/reserve|treasury|btc|bitcoin|sat/i.test(draft.intake.claimsToReview ?? '')) {
    fixes.push('For reserve claims, publish the reserve address, proof method, balance source, and update cadence.');
  }
  return fixes.map((fix) => `- ${safeMarkdown(fix)}`).join('\n');
}

function listValues(values) {
  const filtered = values.map((value) => String(value ?? '').trim()).filter(Boolean);
  if (filtered.length === 0) return 'No evidence provided yet.';
  return filtered.map((value) => `- ${safeMarkdown(value)}`).join('\n');
}

function blockValue(value) {
  const text = String(value ?? '').trim();
  return text ? safeMarkdown(text) : 'No claims provided yet.';
}

function compact(values) {
  return values
    .flatMap((value) => String(value ?? '').split(/\n+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeMarkdown(value) {
  return String(value ?? '')
    .trim()
    .replace(/[<>]/g, '')
    .replace(/\|/g, '\\|') || 'Not provided';
}
