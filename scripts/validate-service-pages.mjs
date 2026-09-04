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

const findings = [];
const revenuePlan = readJson(join('public', 'revenue-operating-plan.json'));
const sitemap = readText(join('public', 'sitemap.xml'));
const reportGenerator = readText(join('scripts', 'generate-transparency-report.mjs'));
const staticExporter = readText(join('scripts', 'prepare-sites-dist.mjs'));
const auditPage = readText(join('app', 'services', 'transparency-audit', 'page.tsx'));

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
  join('app', 'services', 'transparency-audit', 'page.tsx')
];
for (const sourcePath of publicRouteSources) {
  const source = readText(sourcePath);
  if (/href="\//.test(source)) {
    findings.push(`${sourcePath}: root-relative hrefs must use publicPath() for GitHub Pages`);
  }
  if (/src="\//.test(source)) {
    findings.push(`${sourcePath}: root-relative image src values must use publicPath() for GitHub Pages`);
  }
}

const sharedComponent = readText(join('app', 'services', '_components', 'high-value-service-page.tsx'));
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

console.log('Service pages check passed: offer routes, sitemap entries, and approval gates are aligned.');

function readText(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}
