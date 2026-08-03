import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const imageSvg = readFileSync(join('public', 'mainnet', 'sata-image.svg'), 'utf8');
const imagePngBase64 = readFileSync(join('public', 'mainnet', 'sata-image.png'), 'base64');
const headerPngBase64 = readFileSync(join('public', 'sata-x-header.png'), 'base64');
const transparencyJson = readFileSync(join('public', 'transparency', 'latest.json'), 'utf8');
const transparencyMd = readFileSync(join('public', 'transparency', 'latest.md'), 'utf8');
const transparencyHistoryJson = readFileSync(
  join('public', 'transparency', 'history.json'),
  'utf8'
);
const transparencyHistoryMd = readFileSync(join('public', 'transparency', 'history.md'), 'utf8');
const healthJson = readFileSync(join('public', 'health.json'), 'utf8');
const robotsTxt = readFileSync(join('public', 'robots.txt'), 'utf8');
const sitemapXml = readFileSync(join('public', 'sitemap.xml'), 'utf8');
const socialAgentProfile = readFileSync(join('public', 'social-agent-profile.json'), 'utf8');
const socialAgentContentQueue = readFileSync(
  join('public', 'social-agent-content-queue.json'),
  'utf8'
);
const socialAgentMonitoringLog = readFileSync(
  join('public', 'social-agent-monitoring-log.json'),
  'utf8'
);
const projectProfile = readFileSync(join('public', 'project-profile.json'), 'utf8');
const metadataPolicy = readFileSync(join('docs', 'metadata-policy.md'), 'utf8');
const hostingJson = readFileSync(join('.openai', 'hosting.json'), 'utf8');
const report = JSON.parse(transparencyJson);
const history = JSON.parse(transparencyHistoryJson);

rmSync('dist', { recursive: true, force: true });
mkdirSync(join('dist', 'server'), { recursive: true });
mkdirSync(join('dist', '.openai'), { recursive: true });

const server = `
const imageSvg = ${JSON.stringify(imageSvg)};
const imagePngBase64 = ${JSON.stringify(imagePngBase64)};
const headerPngBase64 = ${JSON.stringify(headerPngBase64)};
const transparencyJson = ${JSON.stringify(transparencyJson)};
const transparencyMd = ${JSON.stringify(transparencyMd)};
const transparencyHistoryJson = ${JSON.stringify(transparencyHistoryJson)};
const transparencyHistoryMd = ${JSON.stringify(transparencyHistoryMd)};
const healthJson = ${JSON.stringify(healthJson)};
const robotsTxt = ${JSON.stringify(robotsTxt)};
const sitemapXml = ${JSON.stringify(sitemapXml)};
const socialAgentProfile = ${JSON.stringify(socialAgentProfile)};
const socialAgentContentQueue = ${JSON.stringify(socialAgentContentQueue)};
const socialAgentMonitoringLog = ${JSON.stringify(socialAgentMonitoringLog)};
const projectProfile = ${JSON.stringify(projectProfile)};
const metadataPolicy = ${JSON.stringify(metadataPolicy)};
const transparencyHtml = ${JSON.stringify(buildTransparencyHtml(report))};
const historyHtml = ${JSON.stringify(buildHistoryHtml(history))};

function buildMetadata(origin) {
  const assetBase = 'https://sata-project-reserve.github.io/sata';
  const image = assetBase + '/mainnet/sata-image.png';
  const header = assetBase + '/sata-x-header.png';
  const transparency = 'https://sata-project-reserve.github.io/sata/transparency';
  const repository = 'https://github.com/sata-project-reserve/sata';
  const x = 'https://x.com/SATAReserve';
  const dexscreener = 'https://dexscreener.com/solana/cyrzoxljgnftqjnvyjpym1wftaeogz6kjmyjfb5hud8e';
  const gmgn = 'https://gmgn.ai/sol/token/A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH';
  return {
    name: 'SATA',
    symbol: 'SATA',
    description: 'SATA Reserve Token is a Bitcoin-aligned Solana token and transparency experiment publishing public BTC reserve, liquidity, LP lock, authority, and founder-distribution reports. No redemption promise, price guarantee, yield, or market-support claim.',
    image,
    header,
    external_url: transparency,
    website: transparency,
    twitter: x,
    x,
    github: repository,
    repository,
    dexscreener,
    gmgn,
    temporary_website_note: 'The current website is the public transparency and launch-app surface. A dedicated official website is planned.',
    extensions: {
      website: transparency,
      transparency,
      twitter: x,
      x,
      twitter_username: 'SATAReserve',
      x_username: 'SATAReserve',
      github: repository,
      repository,
      dexscreener,
      gmgn
    },
    links: [
      { label: 'Transparency', url: transparency },
      { label: 'X', url: x },
      { label: 'GitHub', url: repository },
      { label: 'DexScreener', url: dexscreener },
      { label: 'GMGN', url: gmgn }
    ],
    attributes: [
      { trait_type: 'network', value: 'mainnet-beta' },
      { trait_type: 'project_type', value: 'Bitcoin-aligned transparency token' },
      { trait_type: 'website_status', value: 'temporary transparency site' }
    ],
    properties: {
      category: 'image',
      files: [{ uri: image, type: 'image/png' }]
    }
  };
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function withCors(headers) {
  return {
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=300',
    ...headers
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/mainnet/sata-image.svg') {
      return new Response(imageSvg, {
        headers: withCors({ 'content-type': 'image/svg+xml; charset=utf-8' })
      });
    }
    if (url.pathname === '/mainnet/sata-image.png') {
      return new Response(decodeBase64(imagePngBase64), {
        headers: withCors({ 'content-type': 'image/png' })
      });
    }
    if (url.pathname === '/sata-x-header.png') {
      return new Response(decodeBase64(headerPngBase64), {
        headers: withCors({ 'content-type': 'image/png' })
      });
    }
    if (url.pathname === '/mainnet/sata-metadata.json') {
      return new Response(JSON.stringify(buildMetadata(url.origin), null, 2) + '\\n', {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/transparency') {
      return new Response(transparencyHtml, {
        headers: withCors({ 'content-type': 'text/html; charset=utf-8' })
      });
    }
    if (url.pathname === '/transparency/history') {
      return new Response(historyHtml, {
        headers: withCors({ 'content-type': 'text/html; charset=utf-8' })
      });
    }
    if (url.pathname === '/transparency/latest.json') {
      return new Response(transparencyJson, {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/transparency/latest.md') {
      return new Response(transparencyMd, {
        headers: withCors({ 'content-type': 'text/markdown; charset=utf-8' })
      });
    }
    if (url.pathname === '/transparency/history.json') {
      return new Response(transparencyHistoryJson, {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/transparency/history.md') {
      return new Response(transparencyHistoryMd, {
        headers: withCors({ 'content-type': 'text/markdown; charset=utf-8' })
      });
    }
    if (url.pathname === '/health.json') {
      return new Response(healthJson, {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/robots.txt') {
      return new Response(robotsTxt, {
        headers: withCors({ 'content-type': 'text/plain; charset=utf-8' })
      });
    }
    if (url.pathname === '/sitemap.xml') {
      return new Response(sitemapXml, {
        headers: withCors({ 'content-type': 'application/xml; charset=utf-8' })
      });
    }
    if (url.pathname === '/social-agent-profile.json') {
      return new Response(socialAgentProfile, {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/social-agent-content-queue.json') {
      return new Response(socialAgentContentQueue, {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/social-agent-monitoring-log.json') {
      return new Response(socialAgentMonitoringLog, {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/project-profile.json') {
      return new Response(projectProfile, {
        headers: withCors({ 'content-type': 'application/json; charset=utf-8' })
      });
    }
    if (url.pathname === '/docs/metadata-policy.md') {
      return new Response(metadataPolicy, {
        headers: withCors({ 'content-type': 'text/markdown; charset=utf-8' })
      });
    }
    if (url.pathname === '/') {
      return new Response(
        '<!doctype html><title>SATA Reserve Token</title><h1>SATA Reserve Token</h1><p>Proof over promises. Temporary transparency and launch-app surface while the official SATA website is being built. Long-term treasury target: 10 BTC, with no redemption or price guarantee.</p><ul><li><a href="/transparency">Transparency</a></li><li><a href="/transparency/latest.json">latest.json</a></li><li><a href="/transparency/latest.md">latest.md</a></li><li><a href="/transparency/history">history</a></li><li><a href="/transparency/history.json">history.json</a></li><li><a href="/health.json">health.json</a></li><li><a href="/project-profile.json">project-profile.json</a></li><li><a href="/docs/metadata-policy.md">metadata-policy.md</a></li><li><a href="https://github.com/sata-project-reserve/sata">GitHub repository</a></li><li><a href="/social-agent-profile.json">social-agent-profile.json</a></li><li><a href="/social-agent-content-queue.json">social-agent-content-queue.json</a></li><li><a href="/social-agent-monitoring-log.json">social-agent-monitoring-log.json</a></li><li><a href="/mainnet/sata-image.png">sata-image.png</a></li><li><a href="/mainnet/sata-image.svg">sata-image.svg</a></li><li><a href="/sata-x-header.png">sata-x-header.png</a></li><li><a href="/mainnet/sata-metadata.json">sata-metadata.json</a></li><li><a href="https://x.com/SATAReserve">@SATAReserve</a></li></ul>',
        { headers: withCors({ 'content-type': 'text/html; charset=utf-8' }) }
      );
    }
    return new Response('Not found\\n', {
      status: 404,
      headers: withCors({ 'content-type': 'text/plain; charset=utf-8' })
    });
  }
};
`;

writeFileSync(join('dist', 'server', 'index.js'), server.trimStart(), 'utf8');
writeFileSync(join('dist', '.openai', 'hosting.json'), hostingJson, 'utf8');
console.log('Prepared Sites server output in dist');

function buildTransparencyHtml(report) {
  const warnings =
    report.warnings.length === 0
      ? '<li>No active warning-level disclosures.</li>'
      : report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SATA Reserve Token Transparency</title>
  <style>
    :root { color-scheme: light; --bg: #f6f7f9; --panel: #fff; --text: #111827; --muted: #5b6472; --line: #d9dee7; --accent: #0f766e; --warning: #a15c07; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; display: grid; gap: 18px; }
    .hero { min-height: 52vh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr); gap: 18px; align-items: center; border-bottom: 1px solid var(--line); }
    h1 { margin: 0; font-size: clamp(42px, 8vw, 84px); line-height: .95; letter-spacing: 0; }
    h2 { margin: 0; font-size: 24px; }
    p { color: var(--muted); line-height: 1.6; }
    a { color: #0b5f59; }
    .eyebrow { color: #0b5f59; font-size: 13px; font-weight: 700; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .metric, .panel { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 14px; }
    .metric span { display: block; color: var(--muted); font-size: 13px; }
    .metric strong, code { overflow-wrap: anywhere; }
    .panel { display: grid; gap: 10px; }
    .warning { border-left: 4px solid var(--warning); background: #fff7ed; }
    @media (max-width: 800px) { .hero, .grid { grid-template-columns: 1fr; } .hero { min-height: auto; padding-top: 16px; } }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <div>
      <span class="eyebrow">SATA transparency</span>
      <h1>Proof over promises.</h1>
      <p>SATA publishes public checks for token authority, Raydium liquidity, LP lock status, and the Bitcoin reserve. This is not a redemption promise, guaranteed price floor, yield product, or investment claim.</p>
      <p>Long-term treasury target: 10 BTC. The goal is to move attention toward sats, custody, reserves, and proof over time, without promising a conversion path or market price.</p>
      <p><a href="/transparency/latest.json">Latest JSON</a> · <a href="/transparency/latest.md">Latest Markdown</a> · <a href="/transparency/history">History</a> · <a href="/transparency/history.json">History JSON</a> · <a href="/health.json">Health JSON</a> · <a href="/project-profile.json">Project profile</a> · <a href="https://github.com/sata-project-reserve/sata">GitHub repository</a> · <a href="${escapeHtml(report.links.dexscreener)}">DexScreener</a> · <a href="${escapeHtml(report.links.gmgn)}">GMGN</a> · <a href="/social-agent-profile.json">Social agent profile</a> · <a href="/social-agent-content-queue.json">Content queue</a> · <a href="/social-agent-monitoring-log.json">Monitoring log</a> · <a href="https://x.com/SATAReserve">@SATAReserve</a></p>
    </div>
    <div class="panel">
      <div class="metric"><span>Status</span><strong>${escapeHtml(report.status)}</strong></div>
      <div class="metric"><span>Generated UTC</span><strong>${escapeHtml(report.generatedAtUtc)}</strong></div>
      <div class="metric"><span>Source Commit</span><strong><a href="${escapeHtml(report.source.repository)}/commit/${escapeHtml(report.source.commit)}">${escapeHtml(report.source.commit.slice(0, 12))}</a></strong></div>
      <div class="metric"><span>Metadata URI</span><strong>${escapeHtml(report.solana.metadataUri ?? 'unknown')}</strong></div>
      <div class="metric"><span>BTC Proof</span><strong>${escapeHtml(report.bitcoinReserve.status)}</strong></div>
    </div>
  </section>
  <section class="panel">
    <h2>Bitcoin Reserve</h2>
    <div class="grid">
      <div class="metric"><span>Address</span><strong>${escapeHtml(report.bitcoinReserve.address ?? 'pending')}</strong></div>
      <div class="metric"><span>Confirmed Reserve</span><strong>${escapeHtml(report.bitcoinReserve.confirmedReserveSats ?? 'not verified')} sats</strong></div>
      <div class="metric"><span>Proof Status</span><strong>${escapeHtml(report.bitcoinReserve.status)}</strong></div>
      <div class="metric"><span>Sats Per SATA</span><strong>${escapeHtml(report.bitcoinReserve.satsPerSata)}</strong></div>
      <div class="metric"><span>SATA Per Sat</span><strong>${escapeHtml(report.bitcoinReserve.sataPerSat)}</strong></div>
      <div class="metric"><span>1 Sat Per SATA Milestone</span><strong>${escapeHtml(report.bitcoinReserve.targetReserveSatsForOneSatPerSata)} sats</strong></div>
      <div class="metric"><span>10 BTC Treasury Target</span><strong>1,000,000,000 sats</strong></div>
    </div>
    <div class="metric"><span>Proof Message</span><code>${escapeHtml(report.bitcoinReserve.proofMessage ?? 'not published')}</code></div>
    <div class="metric"><span>Proof Signature</span><code>${escapeHtml(report.bitcoinReserve.proofSignature ?? 'not published')}</code></div>
    <div class="metric warning"><span>Proof Validation</span><strong>${escapeHtml(report.bitcoinReserve.proofValidation?.detail ?? 'not checked')}</strong></div>
  </section>
  <section class="panel">
    <h2>Founder And Distribution</h2>
    <p>Current concentration is disclosed as a material risk, not hidden.</p>
    <div class="grid">
      <div class="metric"><span>Stage</span><strong>${escapeHtml(report.distribution.stage)}</strong></div>
      <div class="metric"><span>Founder Role</span><strong>${escapeHtml(report.distribution.founderRole)}</strong></div>
      <div class="metric"><span>Founder GitHub</span><strong><a href="${escapeHtml(report.distribution.founderPublicGithub)}">jboudou007</a></strong></div>
      <div class="metric"><span>Founder Direct SATA</span><strong>${escapeHtml(report.distribution.founderDirectUi)} (${escapeHtml(report.distribution.founderDirectPercent)})</strong></div>
      <div class="metric"><span>SATA In Pool</span><strong>${escapeHtml(report.distribution.poolSataUi)} (${escapeHtml(report.distribution.poolSataPercent)})</strong></div>
      <div class="metric"><span>Outside Founder And Pool</span><strong>${escapeHtml(report.distribution.outsideFounderAndPoolUi)} (${escapeHtml(report.distribution.outsideFounderAndPoolPercent)})</strong></div>
    </div>
    <div class="metric warning"><span>Control Caveat</span><strong>${escapeHtml(report.distribution.controlCaveat)}</strong></div>
    <div class="metric"><span>Intended Direction</span><strong>${escapeHtml(report.distribution.intendedDirection)}</strong></div>
    <div class="metric warning"><span>Independence Disclosure</span><strong>${escapeHtml(report.distribution.founderDisclosure)}</strong></div>
  </section>
  <section class="panel">
    <h2>Liquidity</h2>
    <div class="grid">
      <div class="metric"><span>Pool</span><strong>${escapeHtml(report.liquidity.poolAddress)}</strong></div>
      <div class="metric"><span>SATA Reserve</span><strong>${escapeHtml(report.liquidity.sataReserveUi)}</strong></div>
      <div class="metric"><span>WSOL Reserve</span><strong>${escapeHtml(report.liquidity.wsolReserveUi)}</strong></div>
      <div class="metric"><span>Locked LP</span><strong>${escapeHtml(report.liquidity.totalLockedLpRaw)}</strong></div>
      <div class="metric"><span>Owner Unlocked LP</span><strong>${escapeHtml(report.liquidity.ownerUnlockedLpRaw)}</strong></div>
      <div class="metric"><span>Lock Status</span><strong>${escapeHtml(report.liquidity.lockStatus)}</strong></div>
    </div>
    <div class="metric warning"><span>Disclosure</span><strong>${escapeHtml(report.liquidity.lockDisclosure)}</strong></div>
  </section>
  <section class="panel">
    <h2>Warnings</h2>
    <ul>${warnings}</ul>
  </section>
</main>
</body>
</html>`;
}

function buildHistoryHtml(history) {
  const rows = history.entries
    .map(
      (entry) => `<tr>
        <td>${escapeHtml(entry.observedAtUtc)}</td>
        <td>${escapeHtml(entry.summary.btcReserveSats)}</td>
        <td>${escapeHtml(entry.summary.founderDirectPercent)}</td>
        <td>${escapeHtml(entry.summary.poolSataPercent)}</td>
        <td>${escapeHtml(entry.summary.lockedLpRaw)}</td>
        <td>${escapeHtml(entry.summary.ownerUnlockedLpRaw)}</td>
        <td>${escapeHtml(String(entry.summary.metadataMutable))}<br>${escapeHtml(entry.summary.metadataUri ?? 'unknown')}</td>
        <td><a href="${escapeHtml(entry.links.reportJson)}">report</a> / <a href="${escapeHtml(entry.links.repositoryCommit)}">commit</a> / <a href="${escapeHtml(entry.links.solanaMint)}">mint</a></td>
      </tr>`
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SATA Material History</title>
  <style>
    :root { color-scheme: light; --bg: #f6f7f9; --panel: #fff; --text: #111827; --muted: #5b6472; --line: #d9dee7; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; display: grid; gap: 18px; }
    h1 { margin: 0; font-size: clamp(34px, 6vw, 64px); line-height: 1; letter-spacing: 0; }
    p { color: var(--muted); line-height: 1.6; }
    a { color: #0b5f59; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
    table { width: 100%; min-width: 940px; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; }
  </style>
</head>
<body>
<main>
  <section>
    <h1>SATA Material History</h1>
    <p>Append-only ledger for material reserve, distribution, liquidity, and metadata states. Rows are added when tracked facts change.</p>
    <p><a href="/transparency">Transparency</a> · <a href="/transparency/history.json">History JSON</a> · <a href="/transparency/latest.json">Latest JSON</a></p>
  </section>
  <section class="table-wrap">
    <table>
      <thead><tr><th>Observed UTC</th><th>BTC Sats</th><th>Founder</th><th>Pool SATA</th><th>Locked LP</th><th>Unlocked LP</th><th>Metadata</th><th>Evidence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
</main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
