import Image from 'next/image';

import deliveryKit from '@/public/transparency-audit-delivery-kit.json';
import { publicPath } from '@/lib/public-path';

export const metadata = {
  title: 'SATA Sample Transparency Audit',
  description:
    'A fictional sample SATA transparency audit deliverable showing scope, evidence separation, risk language, and recommended fixes.'
};

const publicInputs = [
  ['Project website', 'https://example.invalid'],
  ['Public profile', 'https://x.com/example_project'],
  ['Token address', 'ExampleMint111111111111111111111111111111111'],
  ['Pool reference', 'Example Raydium CPMM pool URL'],
  ['Reserve claim', 'Project says it holds a public reserve treasury']
];

const authorityFindings = [
  {
    status: 'Verified',
    title: 'Mint authority revoked',
    detail:
      'The token cannot be expanded by the mint authority according to the supplied explorer view.'
  },
  {
    status: 'Verified',
    title: 'Freeze authority revoked',
    detail: 'Wallet-level freezing is not available through the token mint configuration.'
  },
  {
    status: 'Partially verified',
    title: 'Metadata update authority',
    detail:
      'The updater is visible, but the client should explain who controls it and whether future changes require multisig approval.'
  }
];

const evidenceRows = [
  [
    'Liquidity and lock evidence',
    'Partially verified',
    'LP lock link is public, but unlock terms need plain-language summary.'
  ],
  [
    'Reserve or treasury claim',
    'Unverified',
    'Reserve address is listed, but signed wallet proof and balance source are not published.'
  ],
  [
    'Ownership concentration',
    'Partially verified',
    'Top holder data is visible, but team, pool, and exchange wallets are not labelled.'
  ],
  [
    'Disclosure wording',
    'Needs fix',
    'Public copy should remove price-support language and add liquidity-risk language.'
  ]
];

const recommendedFixes = [
  'Publish the exact reserve address, balance source, and signed proof message.',
  'Label owner, team, pool, exchange, and lock accounts in a public holder table.',
  'Describe LP lock mechanics, unlock conditions, and whether any LP remains removable.',
  'Replace price, buyer-demand, or market-support claims with factual evidence links.',
  'Add a short risk note: no price guarantee, no redemption promise, and liquidity can remain thin.'
];

const requiredDisclosures = deliveryKit.deliverableTemplate.requiredDisclosures;

export default function SampleTransparencyAuditPage() {
  return (
    <main className="public-page service-page">
      <section className="service-hero">
        <div className="service-copy">
          <span className="eyebrow">Sample deliverable</span>
          <h1>Sample transparency audit.</h1>
          <p>
            This fictional sample shows what a starter SATA audit can look like before a
            customer pays. It demonstrates evidence separation, disclosure gaps, and concrete
            fixes without rating a token, endorsing a project, or making trading claims.
          </p>
          <div className="inline-actions">
            <a className="button-link" href={deliveryKit.intakeUrl}>
              Request Audit
            </a>
            <a className="button-link" href={publicPath('/services/transparency-audit')}>
              View Service
            </a>
            <a className="button-link" href={publicPath('/transparency-audit-delivery-kit.json')}>
              Delivery Kit
            </a>
          </div>
        </div>
        <div className="service-proof">
          <Image
            src={publicPath('/mainnet/sata-image.png')}
            alt="SATA reserve token mark"
            className="service-mark"
            width={180}
            height={180}
            priority
          />
          <div className="metric service-primary-metric">
            <span>Example Status</span>
            <strong>Fictional sample only</strong>
            <p>This is not a rating, endorsement, recommendation, or investment-grade label.</p>
          </div>
          <div className="metric">
            <span>Delivery Format</span>
            <strong>{deliveryKit.deliverableTemplate.format}</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Scope And Limitations</h2>
          <p>
            The audit reviews public evidence and client-approved citations. Verified,
            partially verified, and unverified claims remain separate.
          </p>
        </div>
        <div className="notice">
          <strong>Fictional Sample</strong>
          <span>
            Example Project is not a real client. This page does not approve any invoice,
            transaction, token grant, promotion, market-making activity, or asset movement.
          </span>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Public Inputs Reviewed</h2>
          <p>Each input would be replaced with the customer&apos;s public links after intake.</p>
        </div>
        <div className="service-checklist">
          {publicInputs.map(([label, value]) => (
            <div className="proof-block" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Token Authority Review</h2>
          <p>Authority checks stay factual and avoid safety or profitability labels.</p>
        </div>
        <div className="service-grid">
          {authorityFindings.map((finding) => (
            <article className="service-offer" key={finding.title}>
              <span>{finding.status}</span>
              <strong>{finding.title}</strong>
              <p>{finding.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Evidence Separation</h2>
          <p>The useful output is a clean map of what readers can and cannot verify.</p>
        </div>
        <div className="service-checklist">
          {evidenceRows.map(([area, status, note]) => (
            <div className="proof-block" key={area}>
              <span>{area}</span>
              <strong>{status}</strong>
              <p>{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Recommended Fixes</h2>
          <p>Every material gap gets at least one concrete fix the team can execute.</p>
        </div>
        <div className="service-checklist">
          {recommendedFixes.map((fix) => (
            <div className="proof-block" key={fix}>
              <strong>{fix}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Required Disclosures</h2>
          <p>These disclosures travel with the final customer-facing deliverable.</p>
        </div>
        <div className="notice">
          <strong>Trading Boundary</strong>
          <span>
            No price guarantee, no redemption promise, no revenue guarantee, and no market-support
            commitment. The audit is not legal, tax, or investment advice.
          </span>
        </div>
        <div className="service-checklist">
          {requiredDisclosures.map((disclosure) => (
            <div className="proof-block" key={disclosure}>
              <strong>{disclosure}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
