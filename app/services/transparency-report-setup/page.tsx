import { HighValueServicePage } from '../_components/high-value-service-page';

export const metadata = {
  title: 'SATA Transparency Report Setup Service',
  description:
    'Repo-based public transparency report setup for crypto teams that need disclosure-ready evidence pages.'
};

export default function TransparencyReportSetupPage() {
  return (
    <HighValueServicePage
      offerId="transparency-report-setup"
      eyebrow="Report Setup"
      heading="Transparency report setup."
      summary="SATA turns public token, reserve, liquidity, authority, and disclosure evidence into a repo-backed transparency report template a client team can maintain."
      primaryAction="Request Setup"
      bestFor={[
        'Teams that already know they need a public report instead of only a gap audit',
        'Projects with authority, liquidity, or reserve claims that need clearer public evidence',
        'Founders who can approve factual wording and maintain the report after delivery'
      ]}
      scope={[
        'Public-report template and disclosure checklist',
        'Authority, liquidity, reserve, and ownership sections mapped to client evidence',
        'Deployment instructions for a static public report',
        'Risk wording that avoids price guarantees, redemption promises, and market-support claims',
        'One handoff checklist for future updates'
      ]}
    />
  );
}
