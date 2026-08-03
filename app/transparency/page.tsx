import report from '@/public/transparency/latest.json';

export const metadata = {
  title: 'SATA Transparency',
  description: 'Public SATA reserve, liquidity, and authority verification report.'
};

type Check = {
  name: string;
  ok: boolean;
  level: 'critical' | 'warning';
  detail: string;
};

const checks = report.checks as Check[];
const PUBLIC_BASE_URL = 'https://sata-project-reserve.github.io/sata';

function passCount(level: Check['level']) {
  return checks.filter((check) => check.level === level && check.ok).length;
}

function totalCount(level: Check['level']) {
  return checks.filter((check) => check.level === level).length;
}

export default function TransparencyPage() {
  const bitcoinReserve = report.bitcoinReserve;
  const distribution = report.distribution;
  const liquidity = report.liquidity;
  const solana = report.solana;

  return (
    <main className="public-page">
      <section className="public-hero">
        <div>
          <span className="eyebrow">SATA transparency</span>
          <h1>Proof over promises.</h1>
          <p>
            SATA publishes public-chain checks for token authority, Raydium liquidity, LP lock
            status, and the Bitcoin reserve. This page is informational only; it is not a
            redemption promise, guaranteed price floor, yield product, or investment claim.
          </p>
          <p>
            Long-term treasury target: 10 BTC. The goal is to move attention toward sats, custody,
            reserves, and proof over time, without promising a conversion path or market price.
          </p>
          <div className="inline-actions">
            <a className="button-link" href={`${PUBLIC_BASE_URL}/transparency/latest.json`}>
              Latest JSON
            </a>
            <a className="button-link" href={`${PUBLIC_BASE_URL}/transparency/latest.md`}>
              Latest Markdown
            </a>
            <a className="button-link" href={`${PUBLIC_BASE_URL}/project-profile.json`}>
              Project Profile
            </a>
            <a className="button-link" href="https://x.com/SATAReserve">
              @SATAReserve
            </a>
          </div>
        </div>
        <div className="proof-stack" aria-label="Current verification status">
          <div className="metric">
            <span>Status</span>
            <strong>{report.status}</strong>
          </div>
          <div className="metric">
            <span>Generated UTC</span>
            <strong>{report.generatedAtUtc}</strong>
          </div>
          <div className="metric">
            <span>Critical Checks</span>
            <strong>
              {passCount('critical')} / {totalCount('critical')}
            </strong>
          </div>
          <div className="metric">
            <span>Warning Checks</span>
            <strong>
              {passCount('warning')} / {totalCount('warning')}
            </strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Bitcoin Reserve</h2>
          <p>Dedicated reserve address with signed address-control proof.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Status</span>
            <strong>{bitcoinReserve.status}</strong>
          </div>
          <div className="metric">
            <span>Confirmed Reserve</span>
            <strong>
              {bitcoinReserve.confirmedReserveSats} sats ({bitcoinReserve.confirmedReserveBtc} BTC)
            </strong>
          </div>
          <div className="metric">
            <span>Reserve Address</span>
            <strong>{bitcoinReserve.address}</strong>
          </div>
          <div className="metric">
            <span>Sats Per SATA</span>
            <strong>{bitcoinReserve.satsPerSata}</strong>
          </div>
          <div className="metric">
            <span>SATA Per Sat</span>
            <strong>{bitcoinReserve.sataPerSat}</strong>
          </div>
          <div className="metric">
            <span>1 Sat Per SATA Milestone</span>
            <strong>{bitcoinReserve.targetReserveSatsForOneSatPerSata} sats</strong>
          </div>
          <div className="metric">
            <span>10 BTC Treasury Target</span>
            <strong>1,000,000,000 sats</strong>
          </div>
        </div>
        <div className="proof-block">
          <span>Proof Message</span>
          <code>{bitcoinReserve.proofMessage ?? 'not published'}</code>
        </div>
        <div className="proof-block">
          <span>Proof Signature</span>
          <code>{bitcoinReserve.proofSignature ?? 'not published'}</code>
        </div>
        <div className="notice">
          <strong>Proof validation</strong>
          <span>{bitcoinReserve.proofValidation?.detail ?? 'not checked'}</span>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Founder And Distribution</h2>
          <p>Current concentration is disclosed as a material risk, not hidden.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Stage</span>
            <strong>{distribution.stage}</strong>
          </div>
          <div className="metric">
            <span>Founder Role</span>
            <strong>{distribution.founderRole}</strong>
          </div>
          <div className="metric">
            <span>Founder GitHub</span>
            <strong>
              <a href={distribution.founderPublicGithub}>jboudou007</a>
            </strong>
          </div>
          <div className="metric">
            <span>Founder Direct SATA</span>
            <strong>
              {distribution.founderDirectUi} ({distribution.founderDirectPercent})
            </strong>
          </div>
          <div className="metric">
            <span>SATA In Pool</span>
            <strong>
              {distribution.poolSataUi} ({distribution.poolSataPercent})
            </strong>
          </div>
          <div className="metric">
            <span>Outside Founder And Pool</span>
            <strong>
              {distribution.outsideFounderAndPoolUi} ({distribution.outsideFounderAndPoolPercent})
            </strong>
          </div>
        </div>
        <div className="notice">
          <strong>Control caveat</strong>
          <span>{distribution.controlCaveat}</span>
        </div>
        <div className="notice safe">
          <strong>Intended direction</strong>
          <span>{distribution.intendedDirection}</span>
        </div>
        <div className="notice">
          <strong>Independence disclosure</strong>
          <span>{distribution.founderDisclosure}</span>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Solana Token</h2>
          <p>Fixed-supply SPL token with mint and freeze authorities revoked.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>SATA Mint</span>
            <strong>{solana.sataMint}</strong>
          </div>
          <div className="metric">
            <span>Supply</span>
            <strong>{solana.supplyUi} SATA</strong>
          </div>
          <div className="metric">
            <span>Mint Authority</span>
            <strong>{solana.mintAuthority ?? 'revoked'}</strong>
          </div>
          <div className="metric">
            <span>Freeze Authority</span>
            <strong>{solana.freezeAuthority ?? 'revoked'}</strong>
          </div>
          <div className="metric">
            <span>Metadata Mutable</span>
            <strong>{String(solana.metadataMutable)}</strong>
          </div>
          <div className="metric">
            <span>Owner SOL</span>
            <strong>{solana.ownerSol}</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Liquidity</h2>
          <p>Raydium CPMM pool with verified initial Burn & Earn lock and disclosed unlocked LP.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Pool</span>
            <strong>{liquidity.poolAddress}</strong>
          </div>
          <div className="metric">
            <span>SATA Reserve</span>
            <strong>{liquidity.sataReserveUi}</strong>
          </div>
          <div className="metric">
            <span>WSOL Reserve</span>
            <strong>{liquidity.wsolReserveUi}</strong>
          </div>
          <div className="metric">
            <span>Locked LP</span>
            <strong>{liquidity.totalLockedLpRaw}</strong>
          </div>
          <div className="metric">
            <span>Owner Unlocked LP</span>
            <strong>{liquidity.ownerUnlockedLpRaw}</strong>
          </div>
          <div className="metric">
            <span>Lock Status</span>
            <strong>{liquidity.lockStatus}</strong>
          </div>
        </div>
        <div className="notice">
          <strong>Disclosure</strong>
          <span>{liquidity.lockDisclosure}</span>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Current Warnings</h2>
          <p>Warnings are published rather than hidden.</p>
        </div>
        <div className="warning-list">
          {report.warnings.length === 0 ? (
            <div className="notice safe">
              <strong>No active warnings</strong>
              <span>All warning-level checks passed in the latest report.</span>
            </div>
          ) : (
            report.warnings.map((warning) => (
              <div className="notice" key={warning}>
                <strong>{warning}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
