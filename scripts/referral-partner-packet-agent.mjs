import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const POLICY_PATH = join('public', 'referral-partner-policy.json');
const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const PUBLIC_BASE_URL = 'https://sata-project-reserve.github.io/sata';

const policy = readJson(POLICY_PATH);
const inboundQueue = readJson(INBOUND_QUEUE_PATH);

export function buildReferralPartnerPacket({
  policy,
  inboundQueue,
  partnerId = 'example-partner',
  displayName = 'Example Partner',
  handle = 'example',
  sourceEvidence = '<dm-or-reply-evidence>',
  requestedCompensation = 'post-receipt referral share',
  generatedAtUtc = new Date().toISOString()
}) {
  const cleanPartnerId = kebab(partnerId || handle || displayName);
  const cleanHandle = cleanHandleValue(handle);
  const sourceId = `referral-partner-${cleanPartnerId}`;
  const serviceUrl = trackedPublicUrl('/services/transparency-audit', {
    utm_source: `referral_${cleanPartnerId}`,
    utm_medium: 'partner_referral',
    utm_campaign: sourceId,
    utm_content: 'transparency_audit'
  });
  const referralPageUrl = trackedPublicUrl('/partners/referrals', {
    utm_source: `referral_${cleanPartnerId}`,
    utm_medium: 'partner_referral',
    utm_campaign: sourceId,
    utm_content: 'policy'
  });
  const sampleAuditUrl = trackedPublicUrl('/services/sample-audit', {
    utm_source: `referral_${cleanPartnerId}`,
    utm_medium: 'partner_referral',
    utm_campaign: sourceId,
    utm_content: 'sample_audit'
  });

  const packet = {
    project: policy.project,
    mode: 'referral-partner-packet',
    generatedAtUtc,
    partner: {
      id: cleanPartnerId,
      displayName: cleanLine(displayName),
      handle: cleanHandle,
      sourceEvidence: cleanLine(sourceEvidence)
    },
    source: {
      sourceType: 'manual-referral',
      sourceId,
      serviceUrl,
      sampleAuditUrl,
      referralPageUrl,
      intakeUrl: inboundQueue.intakeUrl
    },
    compensation: {
      requestedCompensation: cleanLine(requestedCompensation),
      paymentTrigger: policy.compensationModel.paymentTrigger,
      defaultReferralSharePercentOfNetServiceRevenue:
        policy.compensationModel.defaultReferralSharePercentOfNetServiceRevenue,
      maximumReferralSharePercentOfNetServiceRevenue:
        policy.compensationModel.maximumReferralSharePercentOfNetServiceRevenue,
      tokenCompensationAllowed: policy.compensationModel.tokenCompensationAllowed,
      requiresSeparateGrantApproval: policy.compensationModel.requiresSeparateGrantApproval
    },
    requiredDisclosure: policy.requiredPartnerDisclosure,
    requiredEvidenceBeforeCompensation: policy.requiredEvidenceBeforeCompensation,
    replyTemplate: renderPartnerReply({
      policy,
      displayName: cleanLine(displayName),
      serviceUrl,
      sampleAuditUrl,
      referralPageUrl,
      intakeUrl: inboundQueue.intakeUrl
    }),
    recordReferredLeadCommand: `node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType manual-referral --sourceId ${sourceId} --contactHandle "<customer-handle-or-contact>" --publicProfileUrl "<https-customer-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<referral-and-customer-interest-evidence>" --customerAskedForInvoice false`,
    nextAction:
      'Send only chairman-approved factual referral terms, then record any referred customer as an inbound lead before invoice review.',
    boundary:
      'This packet does not approve the partner, compensation, public post, invoice, payment instruction, token grant, transaction, custody change, or asset movement.'
  };

  validateReferralPartnerPacket({ packet, policy, inboundQueue });
  return packet;
}

export function renderReferralPartnerPacket(packet) {
  return [
    '# SATA Referral Partner Packet',
    '',
    `Generated: ${packet.generatedAtUtc}`,
    `Partner: ${packet.partner.displayName} (@${packet.partner.handle})`,
    `Source ID: ${packet.source.sourceId}`,
    '',
    '## Boundary',
    packet.boundary,
    '',
    '## Partner Reply',
    '',
    '```text',
    packet.replyTemplate,
    '```',
    '',
    '## Tracking',
    `Service URL: ${packet.source.serviceUrl}`,
    `Sample audit: ${packet.source.sampleAuditUrl}`,
    `Referral policy: ${packet.source.referralPageUrl}`,
    `Customer intake: ${packet.source.intakeUrl}`,
    '',
    '## Compensation Gate',
    `Payment trigger: ${packet.compensation.paymentTrigger}`,
    `Default share: ${packet.compensation.defaultReferralSharePercentOfNetServiceRevenue}% of net service revenue`,
    `Maximum share: ${packet.compensation.maximumReferralSharePercentOfNetServiceRevenue}% of net service revenue`,
    `Separate token grant approval required: ${packet.compensation.requiresSeparateGrantApproval}`,
    '',
    '## Required Evidence Before Compensation',
    ...packet.requiredEvidenceBeforeCompensation.map((item) => `- ${item}`),
    '',
    '## Record Referred Lead',
    '',
    '```sh',
    packet.recordReferredLeadCommand,
    '```'
  ].join('\n');
}

export function validateReferralPartnerPacket({ packet, policy, inboundQueue }) {
  const findings = [];
  if (packet.mode !== 'referral-partner-packet') findings.push('mode must be referral-partner-packet');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packet.partner?.id ?? '')) {
    findings.push('partner id must be kebab-case');
  }
  if (packet.source?.sourceType !== 'manual-referral') {
    findings.push('sourceType must be manual-referral');
  }
  if (!(inboundQueue.sourceTypes ?? []).includes(packet.source?.sourceType)) {
    findings.push('inbound queue must allow manual-referral source type');
  }
  if (packet.compensation?.paymentTrigger !== policy.compensationModel.paymentTrigger) {
    findings.push('packet must inherit policy payment trigger');
  }
  if (packet.compensation?.requiresSeparateGrantApproval !== true) {
    findings.push('packet must require separate token grant approval');
  }
  if (!/Sponsored\/Paid Partnership|token-compensated referral/i.test(packet.requiredDisclosure ?? '')) {
    findings.push('packet must require paid or token-compensated disclosure');
  }
  if (!/does not approve the partner/i.test(packet.boundary ?? '')) {
    findings.push('boundary must state that the packet approves no partner');
  }
  if (!/customerAskedForInvoice false/i.test(packet.recordReferredLeadCommand ?? '')) {
    findings.push('record command must start referred leads before invoice-request status');
  }
  if (!/\/services\/sample-audit\?/i.test(packet.source?.sampleAuditUrl ?? '')) {
    findings.push('packet must include a tracked sample audit URL');
  }
  for (const required of [
    'Customer request for paid service.',
    'Chairman-approved invoice.',
    'Confirmed customer receipt.',
    'Proposed referral compensation amount and asset.'
  ]) {
    if (!(packet.requiredEvidenceBeforeCompensation ?? []).includes(required)) {
      findings.push(`required evidence missing ${required}`);
    }
  }
  assertNoUnsafePositiveClaims(
    [packet.replyTemplate, packet.requiredDisclosure, packet.nextAction, packet.boundary].join('\n'),
    findings
  );
  if (findings.length > 0) {
    throw new Error(`Referral partner packet is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function renderPartnerReply({ policy, displayName, serviceUrl, sampleAuditUrl, referralPageUrl, intakeUrl }) {
  return [
    `Thanks ${displayName}. SATA can consider referral compensation only for legitimate paid transparency-service referrals.`,
    'Any relationship must be clearly disclosed to your audience before compensated coverage or referral activity.',
    'Compensation is considered only after a referred customer pays and the receipt is confirmed.',
    'No upfront payment, no price or buyer claims, no fake engagement, no bots, no raids, and no market-support commitment.',
    `Service link: ${serviceUrl}`,
    `Sample audit: ${sampleAuditUrl}`,
    `Referral policy: ${referralPageUrl}`,
    `Customer intake: ${intakeUrl}`,
    `Required disclosure: ${policy.requiredPartnerDisclosure}`,
    'Send the referred project, contact path, expected role, requested compensation model, and evidence trail for chairman review.'
  ].join('\n\n');
}

function trackedPublicUrl(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, cleanTrackingValue(value));
  }
  return `${PUBLIC_BASE_URL}${path}?${query.toString()}`;
}

function assertNoUnsafePositiveClaims(text, findings) {
  const cleaned = cleanLine(text)
    .replace(
      /\b(no|not|without|do not|must not)[^.;\n]*(?:upfront payment|price guarantee|redemption promise|price or buyer claims|buyer claims|fake engagement|bots|raids|market-support commitment|market-support|investment return)[^.;\n]*/gi,
      ''
    )
    .replace(/prohibitedPartnerClaims[^}]+/gi, '');
  if (
    /\b(upfront payment|price guarantee|redemption promise|buyer claims|fake engagement|bots|raids|market-support|investment return)\b/i.test(cleaned)
  ) {
    findings.push('packet contains unsafe promotional wording outside negative controls');
  }
}

function cleanTrackingValue(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
}

function cleanHandleValue(value) {
  return cleanLine(value).replace(/^@+/, '').slice(0, 64);
}

function kebab(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command = 'plan', ...args] = process.argv.slice(2);
  const options = parseArgs(args);
  const packet = buildReferralPartnerPacket({
    policy,
    inboundQueue,
    partnerId: options.partner ?? options.partnerId,
    displayName: options.displayName ?? options.name,
    handle: options.handle,
    sourceEvidence: options.sourceEvidence ?? options.evidence,
    requestedCompensation: options.requestedCompensation ?? options.compensation
  });

  if (command === 'plan' || command === 'json') {
    console.log(JSON.stringify(packet, null, 2));
  } else if (command === 'render' || command === 'markdown') {
    console.log(renderReferralPartnerPacket(packet));
  } else {
    throw new Error(
      `Unknown referral partner packet command: ${command}. Use plan, json, render, or markdown.`
    );
  }
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = args[index + 1]?.startsWith('--') ? true : args[index + 1];
    options[key] = value ?? true;
    if (value !== true) index += 1;
  }
  return options;
}
