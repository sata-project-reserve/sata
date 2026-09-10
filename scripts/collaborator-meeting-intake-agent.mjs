import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCollaboratorMeetingIntakeDraft } from './lib/collaborator-meeting-intake-parser.mjs';

const POLICY_PATH = join('public', 'collaborator-meeting-intake.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const policy = await readJson(POLICY_PATH);

  switch (command) {
    case 'plan':
      printPlan(policy);
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], { policy });
      break;
    default:
      throw new Error(
        `Unknown collaborator meeting intake command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

function printPlan(policy) {
  console.log(
    JSON.stringify(
      {
        project: policy.project,
        mode: 'collaborator-meeting-intake-review',
        policyStatus: policy.status,
        issueTemplate: '.github/ISSUE_TEMPLATE/collaborator-meeting-intake.yml',
        requiredFields: [
          'collaboratorName',
          'publicProfileUrl',
          'proposedRole',
          'pastWork',
          'requestedTerms',
          'disclosurePolicy',
          'willingToMeetDubai'
        ],
        nextOperatingAction:
          'Use submitted issues to prepare chairman review only; meetings, compensation, posts, invoices, grants, transactions, custody changes, and asset movement remain separate approvals.',
        boundary:
          'This agent parses collaborator evidence only. It does not approve or schedule meetings, contact collaborators, approve compensation, issue invoices, publish posts, grant tokens, or move assets.'
      },
      null,
      2
    )
  );
}

async function draftFromIssueJson(path, context) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildCollaboratorMeetingIntakeDraft({ issue, ...context }), null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
