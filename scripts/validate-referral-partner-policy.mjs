import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const policy = readJson(join('public', 'referral-partner-policy.json'));
const approvalQueue = readJson(join('public', 'executive-approval-queue.json'));
const findings = [];
const prohibitedPattern =
  /\b(guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|investment return)\b/i;

if (policy.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (policy.mode !== 'draft-referral-partner-policy') {
  findings.push('mode must be draft-referral-partner-policy');
}
if (!/without upfront spend/i.test(policy.objective ?? '')) {
  findings.push('objective must prohibit upfront spend');
}
if (!['pending-executive-chairman-approval', 'approved-by-chairman'].includes(policy.status)) {
  findings.push('status must be pending executive chairman approval or approved by chairman');
}
if (
  policy.status === 'approved-by-chairman' &&
  (policy.approvedBy !== 'executive-chairman' || !policy.approvedAtUtc)
) {
  findings.push('approved referral policy must include approvedBy and approvedAtUtc');
}
if (policy.compensationModel?.paymentTrigger !== 'Only after the referred customer pays and the receipt is confirmed.') {
  findings.push('compensationModel.paymentTrigger must require confirmed customer receipt');
}
if (Number(policy.compensationModel?.maximumReferralSharePercentOfNetServiceRevenue) > 20) {
  findings.push('maximum referral share must stay capped at 20% or below');
}
if (policy.compensationModel?.requiresSeparateGrantApproval !== true) {
  findings.push('token or cash compensation must require separate grant/payment approval');
}
if (!/Sponsored\/Paid Partnership|token-compensated referral/i.test(policy.requiredPartnerDisclosure ?? '')) {
  findings.push('requiredPartnerDisclosure must require paid or token-compensated disclosure');
}
for (const required of [
  /Customer request for paid service/i,
  /Chairman-approved invoice/i,
  /Confirmed customer receipt/i,
  /Proposed referral compensation amount and asset/i
]) {
  if (!(policy.requiredEvidenceBeforeCompensation ?? []).some((item) => required.test(item))) {
    findings.push(`requiredEvidenceBeforeCompensation missing ${required}`);
  }
}
for (const required of [
  /approves the referral policy/i,
  /partner-specific compensation proposal/i,
  /token grant, cash payment, or asset movement/i,
  /customer payment is confirmed/i
]) {
  if (!(policy.approvalGates ?? []).some((item) => required.test(item))) {
    findings.push(`approvalGates missing ${required}`);
  }
}
if (!/compensation is considered only after a referred customer pays/i.test(policy.partnerReplyTemplate ?? '')) {
  findings.push('partnerReplyTemplate must preserve post-receipt compensation boundary');
}
if (!/does not approve any partner/i.test(policy.boundary ?? '')) {
  findings.push('boundary must state that the policy draft approves nothing');
}

const allowedNegativeContext = JSON.stringify(policy)
  .replaceAll(
    /\b(no|not|without|prohibit(?:s|ed)?|reject(?:s|ed)?|fake|must not|do not)\s+(?:any\s+)?(?:price guarantee|redemption promise|market-support commitment|market-support|guaranteed buyers|fake engagement|bots|raids|price prediction|investment return|upfront spend)\b/gi,
    ''
  )
  .replaceAll(JSON.stringify(policy.prohibitedPartnerClaims ?? []), '');
if (prohibitedPattern.test(allowedNegativeContext)) {
  findings.push('policy contains prohibited promotional wording outside negative controls');
}

const approvalItem = (approvalQueue.items ?? []).find((item) => item.id === policy.approvalItemId);
if (!approvalItem) {
  findings.push(`approval queue missing ${policy.approvalItemId}`);
} else {
  if (
    policy.status === 'pending-executive-chairman-approval' &&
    approvalItem.status !== 'ready-for-chairman-review'
  ) {
    findings.push(`${policy.approvalItemId}: approval item must be ready-for-chairman-review`);
  }
  if (policy.status === 'approved-by-chairman' && approvalItem.status !== 'approved-by-chairman') {
    findings.push(`${policy.approvalItemId}: approved policy requires approved approval item`);
  }
  if (approvalItem.category !== 'promoter-offer') {
    findings.push(`${policy.approvalItemId}: approval item must use promoter-offer category`);
  }
  if (approvalItem.requiredChairmanApproval !== true) {
    findings.push(`${policy.approvalItemId}: approval item must require chairman approval`);
  }
  if (!/confirmed customer receipt/i.test(approvalItem.proposedAction ?? '')) {
    findings.push(`${policy.approvalItemId}: proposedAction must require confirmed receipt`);
  }
}

if (findings.length > 0) {
  console.error('Referral partner policy check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Referral partner policy check passed: partner compensation is post-receipt and chairman-gated.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
