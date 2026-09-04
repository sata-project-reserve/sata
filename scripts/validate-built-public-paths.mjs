import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const githubPagesMode = process.env.GITHUB_PAGES === 'true';
const findings = [];
const htmlFiles = [
  join('out', 'index.html'),
  join('out', 'operations.html'),
  join('out', 'services', 'transparency-audit.html'),
  join('out', 'services', 'transparency-report-setup.html'),
  join('out', 'services', 'full-proof-dashboard.html')
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
      /href="\/executive-/,
      /href="\/sats-/,
      /href="\/revenue-/,
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

if (githubPagesMode) {
  const setupPage = readFileSync(join('out', 'services', 'transparency-report-setup.html'), 'utf8');
  const dashboardPage = readFileSync(join('out', 'services', 'full-proof-dashboard.html'), 'utf8');
  const auditPage = readFileSync(join('out', 'services', 'transparency-audit.html'), 'utf8');
  const requiredPublishedPaths = [
    [setupPage, 'href="/sata/services/transparency-audit"'],
    [setupPage, 'src="/sata/mainnet/sata-image.png"'],
    [dashboardPage, 'href="/sata/services/transparency-audit"'],
    [dashboardPage, 'src="/sata/mainnet/sata-image.png"'],
    [auditPage, 'href="/sata/services/transparency-report-setup"'],
    [auditPage, 'href="/sata/services/full-proof-dashboard"'],
    [auditPage, 'src="/sata/mainnet/sata-image.png"']
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
