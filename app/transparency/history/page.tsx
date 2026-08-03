import history from '@/public/transparency/history.json';

export const metadata = {
  title: 'SATA Material History',
  description:
    'Append-only SATA Reserve Token history of material BTC reserve, distribution, liquidity, and metadata states.',
  alternates: {
    canonical: 'https://sata-project-reserve.github.io/sata/transparency/history'
  }
};

type HistoryEntry = {
  observedAtUtc: string;
  stateHash: string;
  summary: {
    btcReserveSats: string;
    founderDirectPercent: string;
    poolSataPercent: string;
    outsideFounderAndPoolPercent: string;
    lockedLpRaw: string;
    ownerUnlockedLpRaw: string;
    metadataMutable: boolean | 'unknown';
    metadataUri: string | null;
  };
  links: {
    reportJson: string;
    repositoryCommit: string;
    bitcoinReserveAddress: string;
    solanaMint: string;
    solanaMetadata: string;
    latestLpLockTransaction: string | null;
    dexscreener: string;
    gmgn: string;
  };
};

const entries = history.entries as HistoryEntry[];

export default function TransparencyHistoryPage() {
  return (
    <main className="public-page">
      <section className="public-band">
        <div className="section-heading">
          <span className="eyebrow">SATA material history</span>
          <h1>State Changes Over Time</h1>
          <p>
            Append-only ledger for material reserve, distribution, liquidity, and metadata states.
            Rows are added when tracked facts change, not merely when a scheduled report runs.
          </p>
          <div className="inline-actions">
            <a className="button-link" href="https://sata-project-reserve.github.io/sata/transparency">
              Transparency
            </a>
            <a
              className="button-link"
              href="https://sata-project-reserve.github.io/sata/transparency/history.json"
            >
              History JSON
            </a>
            <a
              className="button-link"
              href="https://sata-project-reserve.github.io/sata/transparency/latest.json"
            >
              Latest JSON
            </a>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Observed UTC</th>
                <th>BTC Sats</th>
                <th>Founder</th>
                <th>Pool SATA</th>
                <th>Locked LP</th>
                <th>Unlocked LP</th>
                <th>Metadata</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.stateHash}>
                  <td>{entry.observedAtUtc}</td>
                  <td>{entry.summary.btcReserveSats}</td>
                  <td>{entry.summary.founderDirectPercent}</td>
                  <td>{entry.summary.poolSataPercent}</td>
                  <td>{entry.summary.lockedLpRaw}</td>
                  <td>{entry.summary.ownerUnlockedLpRaw}</td>
                  <td>
                    {String(entry.summary.metadataMutable)}
                    <br />
                    <span>{entry.summary.metadataUri ?? 'unknown'}</span>
                  </td>
                  <td>
                    <a href={entry.links.reportJson}>report</a>
                    {' / '}
                    <a href={entry.links.repositoryCommit}>commit</a>
                    {' / '}
                    <a href={entry.links.solanaMint}>mint</a>
                    {entry.links.latestLpLockTransaction ? (
                      <>
                        {' / '}
                        <a href={entry.links.latestLpLockTransaction}>lp lock</a>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
