import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildProspectIntakeDraft,
  recordProspectIntakeDraft
} from './lib/prospect-intake-parser.mjs';
import { renderProspectIntakeComment } from './prospect-intake-comment-agent.mjs';

const pipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'prospect-candidate-intake-issue.json'));
const form = readFileSync(join('.github', 'ISSUE_TEMPLATE', 'prospect-candidate-intake.yml'), 'utf8');
const intakeAgent = readFileSync(join('scripts', 'prospect-intake-agent.mjs'), 'utf8');
const draft = buildProspectIntakeDraft({ issue: issueFixture, pipeline });
const comment = renderProspectIntakeComment(draft);
const findings = [];

if (!/prospect-intake/.test(form)) findings.push('issue form must apply the prospect-intake label');
if (!/prospect-candidate/.test(form)) findings.push('issue form must apply the prospect-candidate label');
if (!/prospect-candidate-intake\.yml/i.test(pipeline.prospectIntakeUrl ?? '')) {
  findings.push('pipeline must publish the prospect candidate intake URL');
}
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
if (!/record-from-issue-json/.test(intakeAgent)) {
  findings.push('prospect intake agent must expose record-from-issue-json');
}
if (!/recordedAtUtc: options\.recordedAtUtc/.test(intakeAgent)) {
  findings.push('record-from-issue-json must require explicit recordedAtUtc input');
}
if (!/writeRevenueCyclePublicStatus/.test(intakeAgent)) {
  findings.push('record-from-issue-json must refresh public revenue cycle status');
}
if (!/record-from-issue-json "<issue-json-path>" --recordedAtUtc "<recorded-at-utc>"/.test(comment)) {
  findings.push('prospect intake comment must expose the bounded record command');
}

const recordedPipeline = recordProspectIntakeDraft({
  issue: issueFixture,
  pipeline,
  recordedAtUtc: '2026-09-11T12:00:00.000Z'
});
const recorded = recordedPipeline.prospects.find((prospect) => prospect.id === 'prospect-intake-202');
if (recorded?.stage !== 'identified') {
  findings.push('recorded prospect must remain identified until chairman review');
}
if (recorded?.stageUpdatedAtUtc !== '2026-09-11T12:00:00.000Z') {
  findings.push('recorded prospect must preserve explicit stageUpdatedAtUtc');
}
if (recorded?.chairmanApprovedBeforeOutreach !== false) {
  findings.push('recorded prospect must not approve outreach');
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
assertRejects('duplicate prospect id', /prospect already exists/i, () =>
  recordProspectIntakeDraft({
    issue: issueFixture,
    pipeline: recordedPipeline,
    recordedAtUtc: '2026-09-11T12:05:00.000Z'
  })
);
assertRejects('missing recordedAtUtc', /recordedAtUtc must be a valid timestamp/i, () =>
  recordProspectIntakeDraft({ issue: issueFixture, pipeline })
);
assertRejects('incomplete intake record', /Prospect intake is incomplete/i, () =>
  recordProspectIntakeDraft({
    issue: {
      ...issueFixture,
      body: '### Prospect name\nIncomplete Team\n'
    },
    pipeline,
    recordedAtUtc: '2026-09-11T12:10:00.000Z'
  })
);

if (findings.length > 0) {
  console.error('Prospect intake workflow check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Prospect intake workflow check passed: issue intake maps to identified prospect drafts.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertRejects(name, expected, fn) {
  try {
    fn();
  } catch (error) {
    if (!expected.test(error.message)) {
      throw new Error(`${name}: expected ${expected}, received ${error.message}`);
    }
    return;
  }
  throw new Error(`${name}: expected rejection.`);
}
