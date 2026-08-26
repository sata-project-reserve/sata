import Image from 'next/image';

import report from '@/public/transparency/latest.json';
import revenuePlan from '@/public/revenue-operating-plan.json';

export const metadata = {
  title: 'SATA Transparency Audit Service',
  description:
    'A compact transparency audit offer for crypto teams that want authority, liquidity, reserve, and disclosure checks.'
};

const auditOffer = revenuePlan.revenueStreams.find((stream) => stream.id === 'transparency-audit');
const setupOffer = revenuePlan.revenueStreams.find(
  (stream) => stream.id === 'transparency-report-setup'
);
const dashboardOffer = revenuePlan.revenueStreams.find(
  (stream) => stream.id === 'full-proof-dashboard'
);

const checks = [
  'Mint, freeze, and metadata authority review',
  'Liquidity pool and LP lock disclosure review',
  'Reserve-claim and proof-language review',
  'Public-reporting gap list',
  'Risk wording and paid-promotion disclosure review'
];

export default function TransparencyAuditServicePage() {
  return (
    <main className="public-page service-page">
      <section className="service-hero">
        <div className="service-copy">
          <span className="eyebrow">SATA services</span>
          <h1>Transparency audits for crypto teams.</h1>
          <p>
            SATA is packaging its own public reporting stack into compact audits and setup work
            for teams that want clearer authority, liquidity, reserve, and disclosure evidence.
          </p>
          <div className="inline-actions">
            <a className="button-link" href="https://x.com/SATAReserve">
              Contact @SATAReserve
            </a>
            <a className="button-link" href="/sats-generation-ledger.json">
              View Sats Ledger
            </a>
            <a className="button-link" href="/sats-invoice-queue.json">
              View Invoice Queue
            </a>
            <a className="button-link" href="/revenue-operating-plan.json">
              View Operating Plan
            </a>
          </div>
        </div>
        <div className="service-proof">
          <Image
            src="/mainnet/sata-image.png"
            alt="SATA reserve token mark"
            className="service-mark"
            width={180}
            height={180}
            priority
          />
          <div className="metric">
            <span>Current SATA Report</span>
            <strong>{report.status}</strong>
          </div>
          <div className="metric">
            <span>Reserve Proof Status</span>
            <strong>{report.bitcoinReserve.status}</strong>
          </div>
          <div className="metric">
            <span>LP Lock Status</span>
            <strong>{report.liquidity.lockStatus}</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Offer Menu</h2>
          <p>Start with a small audit. Upgrade only when deeper setup work is useful.</p>
        </div>
        <div className="service-grid">
          <article className="service-offer">
            <span>{auditOffer?.label}</span>
            <strong>${auditOffer?.priceUsd}</strong>
            <p>{auditOffer?.deliverable}</p>
          </article>
          <article className="service-offer">
            <span>{setupOffer?.label}</span>
            <strong>${setupOffer?.priceUsd}</strong>
            <p>{setupOffer?.deliverable}</p>
          </article>
          <article className="service-offer">
            <span>{dashboardOffer?.label}</span>
            <strong>${dashboardOffer?.priceUsd}</strong>
            <p>{dashboardOffer?.deliverable}</p>
          </article>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Audit Scope</h2>
          <p>A practical review focused on what a public reader can verify.</p>
        </div>
        <div className="service-checklist">
          {checks.map((check) => (
            <div className="proof-block" key={check}>
              <strong>{check}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Payment Path</h2>
          <p>Qualified customers receive an exact sats invoice after chairman approval.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Preferred Settlement</span>
            <strong>BTC to the published reserve address</strong>
          </div>
          <div className="metric">
            <span>Quote Rule</span>
            <strong>Exact sats, source, timestamp, and expiration required</strong>
          </div>
          <div className="metric">
            <span>Custody Rule</span>
            <strong>No agent receives funds or controls keys</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="notice">
          <strong>Boundaries</strong>
          <span>
            No price guarantee, no redemption promise, no revenue guarantee, and no market-support
            commitment. SATA does not sell fake engagement, raids, bots, or investor lists.
          </span>
        </div>
      </section>
    </main>
  );
}
