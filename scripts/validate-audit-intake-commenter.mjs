import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAuditIntakeDraft } from './lib/audit-intake-parser.mjs';
import { renderAuditIntakeComment } from './audit-intake-comment-agent.mjs';

const deliveryKit = readJson(join('public', 'transparency-audit-delivery-kit.json'));
const prospectPipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const invoiceQueue = readJson(join('public', 'sats-invoice-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'transparency-audit-intake-issue.json'));
const eventFixture = readJson(join('tests', 'fixtures', 'transparency-audit-intake-event.json'));
const workflow = readFileSync(join('.github', 'workflows', 'audit-intake.yml'), 'utf8');
const draft = buildAuditIntakeDraft({ issue: issueFixture, deliveryKit, prospectPipeline, invoiceQueue });
const comment = renderAuditIntakeComment(draft);
const findings = [];

if (eventFixture.issue?.body !== issueFixture.body) {
  findings.push('event fixture issue body must match the intake issue fixture');
}
if (!comment.includes('<!-- sata-audit-intake-review -->')) {
  findings.push('comment must include a stable marker for upsert behavior');
}
if (!/No payment instruction has been issued/i.test(comment)) {
  findings.push('comment must clearly state that automation has not issued payment instructions');
}
if (!/Executive Chairman approval is required/i.test(comment)) {
  findings.push('comment must require Executive Chairman approval before invoices or commitments');
}
if (comment.includes(invoiceQueue.paymentPolicy.reserveAddress)) {
  findings.push('comment must not publish the reserve payment address as a payment instruction');
}
if (/quote-required-before-sending/i.test(comment)) {
  findings.push('comment must not expose internal invoice quote placeholders');
}
if (!/service-intake/.test(workflow)) {
  findings.push('audit intake workflow must only run for service-intake issues');
}
if (!/issues:\s*write/.test(workflow)) {
  findings.push('audit intake workflow needs issues: write permission to upsert the review comment');
}
if (!/sata-audit-intake-review/.test(workflow)) {
  findings.push('audit intake workflow must upsert by the stable comment marker');
}
if (!/ops:intake-check/.test(workflow)) {
  findings.push('audit intake workflow must run the intake validator before commenting');
}
if (!/ops:intake-comment-check/.test(workflow)) {
  findings.push('audit intake workflow must run the comment validator before commenting');
}

if (findings.length > 0) {
  console.error('Audit intake commenter check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Audit intake commenter check passed: service-intake issues produce safe chairman-review comments.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
