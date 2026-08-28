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
    return `Review target: ${safeMarkdown(draft.intake.tokenOrContractAddress)}\n\nTODO: Record authority evidence and label each claim verified, partially verified, or unverified.`;
  }
  if (/Liquidity and lock evidence review/i.test(section)) {
    return 'TODO: Review public lock or liquidity evidence. Do not describe liquidity as guaranteed or permanent unless the cited mechanism proves that exact claim.';
  }
  if (/Reserve or treasury claim review/i.test(section)) {
    return 'TODO: Review public reserve or treasury evidence. Do not describe reserves as a redemption promise or guaranteed price floor.';
  }
  if (/Ownership and concentration disclosure review/i.test(section)) {
    return 'TODO: Review holder concentration and any disclosed team, treasury, or unlocked allocations from public evidence.';
  }
  if (/Disclosure gaps/i.test(section)) {
    return 'TODO: List every material missing citation, unclear claim, or disclosure gap with one concrete fix.';
  }
  if (/Risk language/i.test(section)) {
    return 'Required risk language: crypto assets can be volatile, liquidity can be thin, and this review is not financial advice.';
  }
  if (/Recommended fixes/i.test(section)) {
    return 'TODO: Provide practical disclosure fixes only. Do not recommend trading, buying, selling, pumping, or market support.';
  }
  if (/Evidence links/i.test(section)) return listValues(draft.prospectDraft.evidence);
  return 'TODO: Complete this section from public evidence.';
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

function safeMarkdown(value) {
  return String(value ?? '')
    .trim()
    .replace(/[<>]/g, '')
    .replace(/\|/g, '\\|') || 'Not provided';
}
