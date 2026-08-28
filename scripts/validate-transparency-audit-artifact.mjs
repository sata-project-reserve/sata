import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTransparencyAuditArtifact } from './lib/transparency-audit-artifact.mjs';

const deliveryKit = readJson(join('public', 'transparency-audit-delivery-kit.json'));
const prospectPipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const invoiceQueue = readJson(join('public', 'sats-invoice-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'transparency-audit-intake-issue.json'));
const artifact = buildTransparencyAuditArtifact({
  issue: issueFixture,
  deliveryKit,
  prospectPipeline,
  invoiceQueue
});
const findings = [];

for (const disclosure of deliveryKit.deliverableTemplate.requiredDisclosures) {
  if (!artifact.includes(disclosure)) findings.push(`artifact missing disclosure: ${disclosure}`);
}
for (const section of deliveryKit.deliverableTemplate.sections) {
  if (!artifact.includes(`### ${section}`)) findings.push(`artifact missing section: ${section}`);
}
if (!/Draft prepared from client intake/i.test(artifact)) {
  findings.push('artifact must clearly identify itself as a draft');
}
if (!/Executive Chairman approval/i.test(artifact)) {
  findings.push('artifact must require Executive Chairman approval for attribution and public release');
}
if (!/verified, partially verified, and unverified claims/i.test(artifact)) {
  findings.push('artifact must force verification status separation');
}
if (!/No invoice, payment instruction, paid work, token grant, or public commitment is approved/i.test(artifact)) {
  findings.push('artifact must not imply invoice, payment, token grant, or public commitment approval');
}
if (artifact.includes(invoiceQueue.paymentPolicy.reserveAddress)) {
  findings.push('artifact must not include the reserve payment address');
}
if (/safe, profitable, backed, guaranteed, or investment grade/i.test(artifact)) {
  findings.push('artifact must not use prohibited rating language as an affirmative claim');
}

if (findings.length > 0) {
  console.error('Transparency audit artifact check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Transparency audit artifact check passed: intake issues produce bounded draft audit artifacts.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
