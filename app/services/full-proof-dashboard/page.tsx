import { HighValueServicePage } from '../_components/high-value-service-page';

export const metadata = {
  title: 'SATA Full Proof Dashboard Service',
  description:
    'Automated proof dashboard and public JSON workflow setup for crypto teams that need recurring transparency reporting.'
};

export default function FullProofDashboardPage() {
  return (
    <HighValueServicePage
      offerId="full-proof-dashboard"
      eyebrow="Full Proof Dashboard"
      heading="Full proof dashboard setup."
      summary="SATA packages the operating pattern behind its own proof dashboard into a public reporting workflow with machine-readable endpoints and an operator runbook."
      primaryAction="Request Dashboard"
      bestFor={[
        'Teams that want recurring automated public reporting',
        'Projects that need human-readable pages plus public JSON evidence endpoints',
        'Operators who can provide stable source data and approve final deployment wording'
      ]}
      scope={[
        'Automated public report workflow',
        'Proof dashboard with reserve, authority, liquidity, and disclosure sections',
        'Public JSON endpoints for independent verification',
        'Operating runbook for updates, approvals, and evidence retention',
        'Post-launch validation checklist with no trading, liquidity, or price promises'
      ]}
    />
  );
}
