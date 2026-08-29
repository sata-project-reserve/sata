import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProspectIntakeDraft } from './lib/prospect-intake-parser.mjs';

const pipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'prospect-candidate-intake-issue.json'));
const form = readFileSync(join('.github', 'ISSUE_TEMPLATE', 'prospect-candidate-intake.yml'), 'utf8');
const draft = buildProspectIntakeDraft({ issue: issueFixture, pipeline });
const findings = [];

if (!/prospect-intake/.test(form)) findings.push('issue form must apply the prospect-intake label');
if (!/prospect-candidate/.test(form)) findings.push('issue form must apply the prospect-candidate label');
if (!/Executive Chairman approval is required/i.test(form)) {
  findings.push('issue form must disclose chairman approval requirements');
}
if (/payment address|send payment|private key|seed phrase/i.test(form)) {
  findings.push('issue form must not request payments or wallet secrets');
}
if (draft.missingRequiredFields.length > 0) {
  findings.push(`fixture missing required fields: ${draft.missingRequiredFields.join(', ')}`);
}
if (!draft.prospectDraft) {
  findings.push('complete prospect issue must produce a prospectDraft');
}
if (draft.prospectDraft?.stage !== 'identified') {
  findings.push('imported prospect drafts must start at identified until chairman review');
}
if (draft.prospectDraft?.chairmanApprovedBeforeOutreach !== false) {
  findings.push('imported prospect drafts must not claim chairman outreach approval');
}
if (draft.prospectDraft?.recommendedOfferId !== pipeline.primaryOfferId) {
  findings.push('fixture should map to the primary transparency-audit offer');
}
if (!/Executive Chairman review/i.test(draft.nextRequiredAction)) {
  findings.push('complete prospect intakes must route to Executive Chairman review');
}

const incompleteDraft = buildProspectIntakeDraft({
  issue: {
    ...issueFixture,
    body: '### Prospect name\nIncomplete Team\n'
  },
  pipeline
});
if (incompleteDraft.prospectDraft !== null) {
  findings.push('incomplete prospect intakes must not produce a prospectDraft');
}
if (!incompleteDraft.missingRequiredFields.includes('publicProfileUrl')) {
  findings.push('incomplete prospect intakes must report missing publicProfileUrl');
}

if (findings.length > 0) {
  console.error('Prospect intake workflow check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Prospect intake workflow check passed: issue intake maps to identified prospect drafts.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
