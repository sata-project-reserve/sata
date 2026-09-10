import Image from 'next/image';

import referralPolicy from '@/public/referral-partner-policy.json';
import collaboratorMeetingIntake from '@/public/collaborator-meeting-intake.json';
import revenuePlan from '@/public/revenue-operating-plan.json';
import deliveryKit from '@/public/transparency-audit-delivery-kit.json';
import { publicPath } from '@/lib/public-path';

export const metadata = {
  title: 'SATA Referral Partners',
  description:
    'Post-receipt referral partner terms for legitimate SATA transparency-service referrals.'
};

const serviceOffers = revenuePlan.revenueStreams;
const defaultShare =
  referralPolicy.compensationModel.defaultReferralSharePercentOfNetServiceRevenue;
const maxShare = referralPolicy.compensationModel.maximumReferralSharePercentOfNetServiceRevenue;

export default function ReferralPartnersPage() {
  return (
    <main className="public-page service-page">
      <section className="service-hero">
        <div className="service-copy">
          <span className="eyebrow">SATA partners</span>
          <h1>Post-receipt referral partners.</h1>
          <p>
            SATA can work with legitimate referrers who introduce crypto teams that need
            transparency audits, report setup, or proof-dashboard work. Compensation is considered
            only after the referred customer pays and the receipt is confirmed.
          </p>
          <div className="inline-actions">
            <a className="button-link" href={deliveryKit.intakeUrl}>
              Refer A Customer
            </a>
            <a className="button-link" href={collaboratorMeetingIntake.issueIntakeUrl}>
              Request Meeting Review
            </a>
            <a className="button-link" href={publicPath('/services/sample-audit')}>
              Sample Audit
            </a>
            <a className="button-link" href="https://x.com/SATAReserve">
              Contact @SATAReserve
            </a>
            <a className="button-link" href={publicPath('/referral-partner-policy.json')}>
              Policy JSON
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
            <span>Default Share</span>
            <strong>{defaultShare}%</strong>
            <p>Post-receipt, net service revenue, proposal-only.</p>
          </div>
          <div className="metric">
            <span>Maximum Share</span>
            <strong>{maxShare}%</strong>
          </div>
          <div className="metric">
            <span>Payment Trigger</span>
            <strong>{referralPolicy.compensationModel.paymentTrigger}</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Eligible Work</h2>
          <p>Partners source paid service customers, not trading demand or artificial attention.</p>
        </div>
        <div className="service-checklist">
          {referralPolicy.eligibleWork.map((item) => (
            <div className="proof-block" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Service Menu</h2>
          <p>Referral value comes from real customer work that can create confirmed receipts.</p>
        </div>
        <div className="service-grid">
          {serviceOffers.map((offer) => (
            <article className="service-offer" key={offer.id}>
              <span>{offer.label}</span>
              <strong>${offer.priceUsd}</strong>
              <p>{offer.deliverable}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Compensation Gate</h2>
          <p>Every partner-specific payment or token grant stays behind chairman approval.</p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Default Referral Share</span>
            <strong>{defaultShare}% of net service revenue</strong>
          </div>
          <div className="metric">
            <span>Maximum Referral Share</span>
            <strong>{maxShare}% of net service revenue</strong>
          </div>
          <div className="metric">
            <span>Token Compensation</span>
            <strong>{referralPolicy.compensationModel.tokenCompensationAllowed}</strong>
          </div>
          <div className="metric">
            <span>Cash Compensation</span>
            <strong>{referralPolicy.compensationModel.cashCompensationAllowed}</strong>
          </div>
          <div className="metric">
            <span>Grant Approval</span>
            <strong>Separate Executive Chairman approval required</strong>
          </div>
          <div className="metric">
            <span>Upfront Spend</span>
            <strong>Not authorized</strong>
          </div>
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Evidence Required</h2>
          <p>
            Referral compensation is earned from verified service revenue, not promised attention.
          </p>
        </div>
        <div className="service-checklist">
          {referralPolicy.requiredEvidenceBeforeCompensation.map((item) => (
            <div className="proof-block" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Partner Reply Template</h2>
          <p>Use this wording before any partner-specific proposal is prepared.</p>
        </div>
        <pre className="preview">{referralPolicy.partnerReplyTemplate}</pre>
      </section>

      <section className="public-band">
        <div className="section-heading">
          <h2>Face-To-Face Review</h2>
          <p>
            Local collaborator meetings are evidence-first and chairman-gated. The current proposed
            location scope is {collaboratorMeetingIntake.locationScope.primaryLocation}.
          </p>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Intake Status</span>
            <strong>{collaboratorMeetingIntake.status}</strong>
          </div>
          <div className="metric">
            <span>Venue Rule</span>
            <strong>{collaboratorMeetingIntake.locationScope.meetingVenueRule}</strong>
          </div>
          <div className="metric">
            <span>Approval Item</span>
            <strong>{collaboratorMeetingIntake.approvalItemId}</strong>
          </div>
        </div>
        <div className="service-checklist">
          {collaboratorMeetingIntake.requiredSubmission.map((item) => (
            <div className="proof-block" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
        <a className="button-link" href={collaboratorMeetingIntake.issueIntakeUrl}>
          Request Meeting Review
        </a>
      </section>

      <section className="public-band">
        <div className="notice">
          <strong>Required Disclosure</strong>
          <span>{referralPolicy.requiredPartnerDisclosure}</span>
        </div>
        <div className="notice">
          <strong>Boundary</strong>
          <span>
            This page does not approve any partner, post, token grant, cash payment, transaction,
            invoice, or asset movement.
          </span>
        </div>
        <div className="notice">
          <strong>Meeting Intake Boundary</strong>
          <span>{collaboratorMeetingIntake.boundary}</span>
        </div>
      </section>
    </main>
  );
}
