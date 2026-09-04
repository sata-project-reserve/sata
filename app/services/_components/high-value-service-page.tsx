import Image from 'next/image';

import report from '@/public/transparency/latest.json';
import revenuePlan from '@/public/revenue-operating-plan.json';
import prospectPipeline from '@/public/sats-prospect-pipeline.json';
import deliveryKit from '@/public/transparency-audit-delivery-kit.json';

type OfferId = 'transparency-report-setup' | 'full-proof-dashboard';
type RevenueStream = (typeof revenuePlan.revenueStreams)[number];

function getOffer(offerId: OfferId): RevenueStream {
  const offer = revenuePlan.revenueStreams.find((stream) => stream.id === offerId);
  if (!offer) {
    throw new Error(`Missing revenue stream: ${offerId}`);
  }
  return offer;
}

type HighValueServicePageProps = {
  offerId: OfferId;
  eyebrow: string;
  heading: string;
  summary: string;
  bestFor: string[];
  scope: string[];
  primaryAction: string;
};

export function HighValueServicePage({
  offerId,
  eyebrow,
  heading,
  summary,
  bestFor,
  scope,
  primaryAction
}: HighValueServicePageProps) {
  const offer = getOffer(offerId);

  return (
    <main className="public-page service-page">
      <section className="service-hero">
        <div className="service-copy">
          <span className="eyebrow">SATA services</span>
          <h1>{heading}</h1>
          <p>
            {summary} This offer is ${offer.priceUsd} and starts only after Executive Chairman
            approval of scope, invoice terms, and settlement path.
          </p>
          <div className="inline-actions">
            <a className="button-link" href={deliveryKit.intakeUrl}>
              {primaryAction}
            </a>
            <a className="button-link" href="/services/transparency-audit">
              Start With Audit
            </a>
            <a className="button-link" href="https://x.com/SATAReserve">
              Contact @SATAReserve
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
          <div className="metric service-primary-metric">
            <span>{offer.label}</span>
            <strong>${offer.priceUsd}</strong>
            <p>{offer.paymentTiming}.</p>
          </div>
          <div className="metric">
            <span>Current SATA Report</span>
            <strong>{report.status}</strong>
          </div>
          <div className="metric">
            <span>Reserve Proof Status</span>
            <strong>{report.bitcoinReserve.status}</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>{eyebrow}</h2>
          <p>{offer.deliverable}</p>
        </div>
        <div className="service-checklist">
          {bestFor.map((item) => (
            <div className="proof-block" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Scope</h2>
          <p>Each engagement stays factual, evidence-backed, and easy for the public to inspect.</p>
        </div>
        <div className="service-checklist">
          {scope.map((item) => (
            <div className="proof-block" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Payment Gate</h2>
          <p>Qualified customers receive exact payment instructions only after approval.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Approval</span>
            <strong>Executive Chairman approves final scope and invoice before payment</strong>
          </div>
          <div className="metric">
            <span>Settlement</span>
            <strong>BTC, USDC on Solana, or SOL only through a recorded invoice path</strong>
          </div>
          <div className="metric">
            <span>Custody Rule</span>
            <strong>No agent receives funds, controls keys, or approves spending</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Revenue Use</h2>
          <p>{revenuePlan.objective}</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Target Customer</span>
            <strong>{prospectPipeline.idealCustomerProfile[0]?.description}</strong>
          </div>
          <div className="metric">
            <span>Reserve Allocation Policy</span>
            <strong>{revenuePlan.allocationPolicy.postReceiptAllocationPercent.btcReserve}% to BTC reserve after receipt approval</strong>
          </div>
          <div className="metric">
            <span>Evidence Rule</span>
            <strong>Receipt, delivery, and allocation evidence must be recorded publicly or internally</strong>
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
