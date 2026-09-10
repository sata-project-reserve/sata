import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const serviceRoutes = [
  {
    id: 'transparency-audit',
    path: '/services/transparency-audit',
    file: join('app', 'services', 'transparency-audit', 'page.tsx'),
    heading: 'Transparency audits for crypto teams.',
    price: '$50'
  },
  {
    id: 'transparency-report-setup',
    path: '/services/transparency-report-setup',
    file: join('app', 'services', 'transparency-report-setup', 'page.tsx'),
    heading: 'Transparency report setup.',
    price: '$150'
  },
  {
    id: 'full-proof-dashboard',
    path: '/services/full-proof-dashboard',
    file: join('app', 'services', 'full-proof-dashboard', 'page.tsx'),
    heading: 'Full proof dashboard setup.',
    price: '$300'
  }
];
const partnerRoutes = [
  {
    id: 'referral-partners',
    path: '/partners/referrals',
    file: join('app', 'partners', 'referrals', 'page.tsx'),
    heading: 'Post-receipt referral partners.'
  }
];
const sampleAuditRoute = {
  path: '/services/sample-audit',
  file: join('app', 'services', 'sample-audit', 'page.tsx'),
  heading: 'Sample transparency audit.'
};

const findings = [];
const revenuePlan = readJson(join('public', 'revenue-operating-plan.json'));
const sitemap = readText(join('public', 'sitemap.xml'));
const reportGenerator = readText(join('scripts', 'generate-transparency-report.mjs'));
const staticExporter = readText(join('scripts', 'prepare-sites-dist.mjs'));
const auditPage = readText(join('app', 'services', 'transparency-audit', 'page.tsx'));
const referralPage = readText(join('app', 'partners', 'referrals', 'page.tsx'));
const operationsPage = readText(join('app', 'operations', 'page.tsx'));
const collaboratorMeetingIntake = readJson(join('public', 'collaborator-meeting-intake.json'));

const revenueStreams = revenuePlan.revenueStreams ?? [];
for (const route of serviceRoutes) {
  const offer = revenueStreams.find((stream) => stream.id === route.id);
  if (!offer) {
    findings.push(`${route.id}: missing revenue stream`);
    continue;
  }
  if (offer.priceUsd !== route.price.replace('$', '')) {
    findings.push(`${route.id}: revenue stream price must be ${route.price}`);
  }
  if (!existsSync(route.file)) {
    findings.push(`${route.path}: route file is missing`);
    continue;
  }
  const pageSource = readText(route.file);
  if (!pageSource.includes(route.heading)) {
    findings.push(`${route.path}: page must publish heading "${route.heading}"`);
  }
  if (route.id !== 'transparency-audit' && !pageSource.includes(route.id)) {
    findings.push(`${route.path}: page must bind to revenue stream ${route.id}`);
  }
  if (!sitemap.includes(`https://sata-project-reserve.github.io/sata${route.path}`)) {
    findings.push(`${route.path}: public sitemap is missing route`);
  }
  if (!reportGenerator.includes(`\${PUBLIC_BASE_URL}${route.path}`)) {
    findings.push(`${route.path}: transparency report sitemap generator is missing route`);
  }
  if (!staticExporter.includes(`url.pathname === '${route.path}'`)) {
    findings.push(`${route.path}: Sites static exporter is missing fallback route`);
  }
}

for (const route of serviceRoutes.slice(1)) {
  if (!auditPage.includes(`publicPath('${route.path}')`)) {
    findings.push(`/services/transparency-audit: offer menu must link to ${route.path}`);
  }
}
for (const route of partnerRoutes) {
  if (!existsSync(route.file)) {
    findings.push(`${route.path}: route file is missing`);
    continue;
  }
  const pageSource = readText(route.file);
  if (!pageSource.includes(route.heading)) {
    findings.push(`${route.path}: page must publish heading "${route.heading}"`);
  }
  if (!/Only after the referred customer pays and the receipt is confirmed/i.test(pageSource)) {
    findings.push(`${route.path}: page must preserve post-receipt payment trigger`);
  }
  if (!/This page does not approve any partner/i.test(pageSource)) {
    findings.push(`${route.path}: page must preserve no-approval boundary`);
  }
  if (!sitemap.includes(`https://sata-project-reserve.github.io/sata${route.path}`)) {
    findings.push(`${route.path}: public sitemap is missing route`);
  }
  if (!reportGenerator.includes(`\${PUBLIC_BASE_URL}${route.path}`)) {
    findings.push(`${route.path}: transparency report sitemap generator is missing route`);
  }
  if (!staticExporter.includes(`url.pathname === '${route.path}'`)) {
    findings.push(`${route.path}: Sites static exporter is missing fallback route`);
  }
}
if (!auditPage.includes("publicPath('/partners/referrals')")) {
  findings.push('/services/transparency-audit: public page must link to referral partners');
}
if (!existsSync(sampleAuditRoute.file)) {
  findings.push(`${sampleAuditRoute.path}: route file is missing`);
} else {
  const sampleAuditPage = readText(sampleAuditRoute.file);
  for (const required of [
    sampleAuditRoute.heading,
    'Fictional sample',
    'not a rating',
    'This page does not approve any invoice',
    'No price guarantee',
    'no redemption promise'
  ]) {
    if (!sampleAuditPage.includes(required)) {
      findings.push(`${sampleAuditRoute.path}: sample page missing ${required}`);
    }
  }
  if (!/no market-support\s+commitment/i.test(sampleAuditPage)) {
    findings.push(`${sampleAuditRoute.path}: sample page missing no market-support commitment`);
  }
}
if (!auditPage.includes("publicPath('/services/sample-audit')")) {
  findings.push('/services/transparency-audit: public page must link to sample audit');
}
if (!referralPage.includes("publicPath('/services/sample-audit')")) {
  findings.push('/partners/referrals: public page must link to sample audit');
}
for (const required of [
  'collaboratorMeetingIntake',
  'Face-To-Face Review',
  'Request Meeting Review',
  'collaboratorMeetingIntake.issueIntakeUrl',
  'collaboratorMeetingIntake.locationScope.primaryLocation',
  'collaboratorMeetingIntake.boundary'
]) {
  if (!referralPage.includes(required)) {
    findings.push(`/partners/referrals: collaborator meeting section missing ${required}`);
  }
}
for (const required of [
  'Referral Handoff Queue',
  'referralPartnerHandoffQueue',
  'referralPartnerHandoffPacket',
  'writeReferralHandoffPacketCommand',
  "publicPath('/referral-partner-handoff-packet.md')",
  "publicPath('/referral-handoff-dispatch-brief.md')",
  'recordReferralHandoffSentCommand',
  'recordReferralHandoffResponseCommand',
  'recordReferralLeadCommand'
]) {
  if (!operationsPage.includes(required)) {
    findings.push(`/operations: referral handoff queue must expose ${required}`);
  }
}
if (!/recordSentCommand/.test(operationsPage)) {
  findings.push(
    '/operations: referral handoff sent command must reuse the approved packet command'
  );
}
if (!/--messageHash "<approved-terms-sha256>"/.test(operationsPage)) {
  findings.push(
    '/operations: referral handoff sent fallback command must require approved terms SHA-256'
  );
}
for (const required of [
  'Qualified Gross Path',
  'Qualified Reserve Path',
  'Qualified Planning Impact',
  'Current Approved Ask',
  'Qualified Revenue Path',
  'Upgrade Gate',
  'only after explicit fit'
]) {
  if (!operationsPage.includes(required)) {
    findings.push(`/operations: manual outreach section must expose ${required}`);
  }
}
if (!sitemap.includes(`https://sata-project-reserve.github.io/sata${sampleAuditRoute.path}`)) {
  findings.push(`${sampleAuditRoute.path}: public sitemap is missing route`);
}
if (!reportGenerator.includes(`\${PUBLIC_BASE_URL}${sampleAuditRoute.path}`)) {
  findings.push(`${sampleAuditRoute.path}: transparency report sitemap generator is missing route`);
}
if (!staticExporter.includes(`url.pathname === '${sampleAuditRoute.path}'`)) {
  findings.push(`${sampleAuditRoute.path}: Sites static exporter is missing fallback route`);
}

const publicPathHelper = readText(join('lib', 'public-path.ts'));
const nextConfig = readText(join('next.config.ts'));
if (!/NEXT_PUBLIC_SITE_BASE_PATH/.test(publicPathHelper)) {
  findings.push('lib/public-path.ts must read NEXT_PUBLIC_SITE_BASE_PATH');
}
if (!/GITHUB_PAGES/.test(nextConfig) || !/NEXT_PUBLIC_SITE_BASE_PATH/.test(nextConfig)) {
  findings.push('next.config.ts must expose NEXT_PUBLIC_SITE_BASE_PATH for GitHub Pages builds');
}

const publicRouteSources = [
  join('app', 'operations', 'page.tsx'),
  join('app', 'services', '_components', 'high-value-service-page.tsx'),
  join('app', 'services', 'transparency-audit', 'page.tsx'),
  join('app', 'services', 'sample-audit', 'page.tsx'),
  join('app', 'partners', 'referrals', 'page.tsx')
];
for (const sourcePath of publicRouteSources) {
  const source = readText(sourcePath);
  if (/href="\//.test(source)) {
    findings.push(`${sourcePath}: root-relative hrefs must use publicPath() for GitHub Pages`);
  }
  if (/src="\//.test(source)) {
    findings.push(
      `${sourcePath}: root-relative image src values must use publicPath() for GitHub Pages`
    );
  }
}

const sharedComponent = readText(
  join('app', 'services', '_components', 'high-value-service-page.tsx')
);
for (const required of [
  /Executive Chairman\s+approval\s+of\s+scope,\s+invoice\s+terms,\s+and\s+settlement\s+path/i,
  /No agent receives funds, controls keys, or approves spending/i,
  /No price guarantee,\s+no redemption promise,\s+no revenue guarantee,\s+and no market-support\s+commitment/i,
  /fake engagement, raids, bots, or investor lists/i
]) {
  if (!required.test(sharedComponent)) {
    findings.push(`high-value service component missing ${required}`);
  }
}

const staticExporterControls = [
  /Executive Chairman approves final scope and invoice before payment/i,
  /No agent receives funds, controls keys, or approves spending/i,
  /No price guarantee, no redemption promise, no revenue guarantee, and no market-support commitment/i
];
for (const required of staticExporterControls) {
  if (!required.test(staticExporter)) {
    findings.push(`static exporter missing ${required}`);
  }
}

if (findings.length > 0) {
  console.error('Service pages check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Service pages check passed: offer routes, sitemap entries, and approval gates are aligned.'
);

function readText(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}
