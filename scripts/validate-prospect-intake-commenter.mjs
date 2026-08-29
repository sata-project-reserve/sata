import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProspectIntakeDraft } from './lib/prospect-intake-parser.mjs';
import { renderProspectIntakeComment } from './prospect-intake-comment-agent.mjs';

const pipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'prospect-candidate-intake-issue.json'));
const eventFixture = readJson(join('tests', 'fixtures', 'prospect-candidate-intake-event.json'));
const workflow = readFileSync(join('.github', 'workflows', 'prospect-intake.yml'), 'utf8');
const draft = buildProspectIntakeDraft({ issue: issueFixture, pipeline });
const comment = renderProspectIntakeComment(draft);
const findings = [];

if (eventFixture.issue?.body !== issueFixture.body) {
  findings.push('event fixture issue body must match the prospect issue fixture');
}
if (!comment.includes('<!-- sata-prospect-intake-review -->')) {
  findings.push('comment must include a stable marker for upsert behavior');
}
if (!/No outreach, invoice, payment request/i.test(comment)) {
  findings.push('comment must state that automation approved no outreach or payment request');
}
if (!/Executive Chairman approval is required/i.test(comment)) {
  findings.push('comment must require Executive Chairman approval before contact or commitments');
}
if (!/Stage: identified/i.test(comment)) {
  findings.push('comment must keep draft prospect stage at identified');
}
if (/payment address|quote-required-before-sending|private key|seed phrase/i.test(comment)) {
  findings.push('comment must not expose payment instructions, placeholders, or wallet secrets');
}
if (!/prospect-intake/.test(workflow)) {
  findings.push('prospect intake workflow must only run for prospect-intake issues');
}
if (!/issues:\s*write/.test(workflow)) {
  findings.push('prospect intake workflow needs issues: write permission to upsert the review comment');
}
if (!/sata-prospect-intake-review/.test(workflow)) {
  findings.push('prospect intake workflow must upsert by the stable comment marker');
}
if (!/ops:prospect-intake-check/.test(workflow)) {
  findings.push('prospect intake workflow must run the intake validator before commenting');
}
if (!/ops:prospect-intake-comment-check/.test(workflow)) {
  findings.push('prospect intake workflow must run the comment validator before commenting');
}

if (findings.length > 0) {
  console.error('Prospect intake commenter check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Prospect intake commenter check passed: prospect-intake issues produce safe chairman-review comments.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
