import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const githubPagesMode = process.env.GITHUB_PAGES === 'true';
const findings = [];
const htmlFiles = [
  join('out', 'index.html'),
  join('out', 'operations.html'),
  join('out', 'partners', 'referrals.html'),
  join('out', 'services', 'sample-audit.html'),
  join('out', 'services', 'transparency-audit.html'),
  join('out', 'services', 'transparency-report-setup.html'),
  join('out', 'services', 'full-proof-dashboard.html')
];
const publicFiles = [
  join('out', 'revenue-execution-brief.json'),
  join('out', 'revenue-execution-brief.md'),
  join('out', 'outreach-dispatch-brief.json'),
  join('out', 'outreach-dispatch-brief.md'),
  join('out', 'reply-conversion-brief.json'),
  join('out', 'reply-conversion-brief.md'),
  join('out', 'referral-handoff-dispatch-brief.json'),
  join('out', 'referral-handoff-dispatch-brief.md'),
  join('out', 'social-dispatch-brief.json'),
  join('out', 'social-dispatch-brief.md'),
  join('out', 'settlement-options-brief.json'),
  join('out', 'settlement-options-brief.md'),
  join('out', 'sats-target-plan.json'),
  join('out', 'sats-target-plan.md')
];

for (const htmlFile of htmlFiles) {
  if (!existsSync(htmlFile)) {
    findings.push(`${htmlFile}: exported HTML file is missing`);
    continue;
  }
  const html = readFileSync(htmlFile, 'utf8');
  if (githubPagesMode) {
    for (const pattern of [
      /href="\/services\//,
      /href="\/transparency(?:["/?])/,
      /href="\/operations(?:["/?])/,
      /href="\/partners\//,
      /href="\/executive-/,
      /href="\/sats-/,
      /href="\/revenue-/,
      /href="\/reply-/,
      /href="\/referral-/,
      /href="\/social-/,
      /href="\/settlement-/,
      /href="\/service-/,
      /src="\/mainnet\//,
      /href="\/mainnet\//,
      /src="\/sata-default\.svg"/
    ]) {
      if (pattern.test(html)) {
        findings.push(`${htmlFile}: contains unprefixed GitHub Pages path matching ${pattern}`);
      }
    }
  }
}

for (const publicFile of publicFiles) {
  if (!existsSync(publicFile)) {
    findings.push(`${publicFile}: exported public file is missing`);
  }
}

if (githubPagesMode) {
  const setupPage = readFileSync(join('out', 'services', 'transparency-report-setup.html'), 'utf8');
  const dashboardPage = readFileSync(join('out', 'services', 'full-proof-dashboard.html'), 'utf8');
  const auditPage = readFileSync(join('out', 'services', 'transparency-audit.html'), 'utf8');
  const sampleAuditPage = readFileSync(join('out', 'services', 'sample-audit.html'), 'utf8');
  const referralPage = readFileSync(join('out', 'partners', 'referrals.html'), 'utf8');
  const requiredPublishedPaths = [
    [setupPage, 'href="/sata/services/transparency-audit"'],
    [setupPage, 'src="/sata/mainnet/sata-image.png"'],
    [dashboardPage, 'href="/sata/services/transparency-audit"'],
    [dashboardPage, 'src="/sata/mainnet/sata-image.png"'],
    [auditPage, 'href="/sata/services/transparency-report-setup"'],
    [auditPage, 'href="/sata/services/full-proof-dashboard"'],
    [auditPage, 'href="/sata/services/sample-audit"'],
    [auditPage, 'href="/sata/partners/referrals"'],
    [auditPage, 'src="/sata/mainnet/sata-image.png"'],
    [sampleAuditPage, 'href="/sata/services/transparency-audit"'],
    [sampleAuditPage, 'href="/sata/transparency-audit-delivery-kit.json"'],
    [sampleAuditPage, 'src="/sata/mainnet/sata-image.png"'],
    [referralPage, 'href="/sata/services/sample-audit"'],
    [referralPage, 'href="/sata/referral-partner-policy.json"'],
    [referralPage, 'src="/sata/mainnet/sata-image.png"']
  ];
  for (const [html, expected] of requiredPublishedPaths) {
    if (!html.includes(expected)) {
      findings.push(`GitHub Pages export missing ${expected}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Built public path check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  githubPagesMode
    ? 'Built public path check passed: GitHub Pages export uses /sata-prefixed public links.'
    : 'Built public path check passed: exported public files are present.'
);
