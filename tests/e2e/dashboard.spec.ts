import { expect, test, type Page } from '@playwright/test';

async function openLaunchStep(page: Page, name: RegExp, heading: string) {
  await expect(async () => {
    await page.getByRole('button', { name }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

test('dashboard renders wallet safety status', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'SATA Token Launcher' })).toBeVisible();
  await expect(page.getByText(/Mainnet: (locked|unlocked)/)).toBeVisible();
  await expect(page.getByText('Signing must occur inside MetaMask')).toBeVisible();
});

test('token form displays base-unit supply', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openLaunchStep(page, /Configure token/, 'Configure token');
  await expect(page.getByText('Base-unit supply: 1000000000000000000')).toBeVisible();
});

test('liquidity planner exposes permanent LP lock controls', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openLaunchStep(page, /Liquidity planner/, 'Liquidity planner');
  await expect(page.getByText('Raydium Burn & Earn LP locking is permanent')).toBeVisible();
  await expect(page.getByLabel('LP lock confirmation phrase')).toHaveAttribute(
    'placeholder',
    'LOCK SATA LP FOREVER'
  );
  await expect(
    page.getByRole('button', { name: 'Prepare Raydium Burn & Earn LP Lock' })
  ).toBeVisible();
});

test('public transparency page publishes reserve proof status', async ({ page }) => {
  await page.goto('/transparency');
  await expect(page.getByRole('heading', { name: 'Proof over promises.' })).toBeVisible();
  await expect(page.getByText('verified-balance-and-published-proof')).toBeVisible();
  await expect(
    page.getByText('Confirmed Reserve').locator('..').getByText('500000 sats')
  ).toBeVisible();
  await expect(page.getByText('LOCKED_BY_RAYDIUM_BURN_AND_EARN')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sats Generation' })).toBeVisible();
  await expect(page.getByText('confirmed BTC reserve sats')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Founder And Distribution' })).toBeVisible();
});

test('transparency audit service page publishes offer and boundaries', async ({ page }) => {
  await page.goto('/services/transparency-audit');
  await expect(
    page.getByRole('heading', { name: 'Transparency audits for crypto teams.' })
  ).toBeVisible();
  await expect(page.locator('.service-primary-metric')).toContainText('Starter Audit');
  await expect(page.locator('.service-primary-metric')).toContainText('$249');
  await expect(page.locator('.service-primary-metric')).toContainText('24-hour target');
  await expect(
    page.getByRole('article').filter({ hasText: 'SATA Transparency Audit' })
  ).toContainText('$249');
  await expect(page.getByRole('heading', { name: 'Payment Path' })).toBeVisible();
  await expect(page.getByText('BTC to the published reserve address')).toBeVisible();
  await expect(page.getByText('Commercial intent')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invoice-Ready Intake' })).toBeVisible();
  await expect(page.getByText('Token, contract, or mint address')).toBeVisible();
  await expect(
    page.getByText('Confirmation that an exact-sats invoice should be prepared for chairman review')
  ).toBeVisible();
  await expect(page.getByText('Intake does not approve work or payment')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Submit Invoice-Ready Intake' })).toHaveAttribute(
    'href',
    'https://github.com/sata-project-reserve/sata/issues/new?template=transparency-audit-intake.yml'
  );
  await expect(page.getByRole('heading', { name: 'Sales Pipeline' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Prospect Pipeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Delivery Kit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Delivery Kit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request Audit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Sample Audit' }).first()).toHaveAttribute(
    'href',
    '/services/sample-audit'
  );
  await expect(page.getByRole('heading', { name: 'Upgrade Path' })).toBeVisible();
  await expect(
    page.getByText('Offer the $4999/month continuous transparency monitoring plan only')
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Setup' })).toHaveAttribute(
    'href',
    '/services/transparency-report-setup'
  );
  await expect(page.getByRole('link', { name: 'View Dashboard' })).toHaveAttribute(
    'href',
    '/services/full-proof-dashboard'
  );
  await expect(page.getByText('No price guarantee')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact @SATAReserve' })).toBeVisible();
});

test('sample transparency audit page publishes fictional deliverable boundaries', async ({
  page
}) => {
  await page.goto('/services/sample-audit');
  await expect(page.getByRole('heading', { name: 'Sample transparency audit.' })).toBeVisible();
  await expect(page.getByText('Fictional Sample', { exact: true })).toBeVisible();
  await expect(page.getByText('not a rating')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Public Inputs Reviewed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Token Authority Review' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence Separation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recommended Fixes' })).toBeVisible();
  const tradingBoundary = page.locator('.notice').filter({ hasText: 'Trading Boundary' });
  await expect(tradingBoundary.getByText('No price guarantee')).toBeVisible();
  await expect(tradingBoundary.getByText('no redemption promise')).toBeVisible();
  await expect(tradingBoundary.getByText('no market-support commitment')).toBeVisible();
  await expect(page.getByText('This page does not approve any invoice')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Service' })).toHaveAttribute(
    'href',
    '/services/transparency-audit'
  );
});

test('higher-value service pages publish gates and boundaries', async ({ page }) => {
  await page.goto('/services/transparency-report-setup');
  await expect(page.getByRole('heading', { name: 'Transparency report setup.' })).toBeVisible();
  await expect(page.locator('.service-primary-metric')).toContainText('$999');
  await expect(page.getByRole('heading', { name: 'Payment Gate' })).toBeVisible();
  await expect(page.getByText('Executive Chairman approves final scope and invoice')).toBeVisible();
  await expect(
    page.getByText('No agent receives funds, controls keys, or approves spending')
  ).toBeVisible();
  await expect(page.getByText('No price guarantee')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start With Audit' })).toHaveAttribute(
    'href',
    '/services/transparency-audit'
  );

  await page.goto('/services/full-proof-dashboard');
  await expect(page.getByRole('heading', { name: 'Full proof dashboard setup.' })).toBeVisible();
  await expect(page.locator('.service-primary-metric')).toContainText('$4999');
  await expect(page.getByText('Public JSON endpoints for independent verification')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revenue Use' })).toBeVisible();
  await expect(page.getByText('No market-support')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request Dashboard' })).toBeVisible();
});

test('referral partner page publishes post-receipt gates', async ({ page }) => {
  await page.goto('/partners/referrals', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Post-receipt referral partners.' })
  ).toBeVisible();
  await expect(page.locator('.service-primary-metric')).toContainText('Default Share');
  await expect(page.locator('.service-primary-metric')).toContainText('10%');
  await expect(
    page.getByText('Only after the referred customer pays and the receipt is confirmed.', {
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Compensation Gate' })).toBeVisible();
  await expect(page.getByText('Not authorized')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence Required' })).toBeVisible();
  await expect(page.getByText('Chairman-approved invoice')).toBeVisible();
  await expect(page.getByText('Confirmed customer receipt')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partner Reply Template' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Face-To-Face Review' })).toBeVisible();
  await expect(page.getByText('Dubai, UAE')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request Meeting Review' }).first()).toHaveAttribute(
    'href',
    'https://github.com/sata-project-reserve/sata/issues/new?template=collaborator-meeting-intake.yml'
  );
  await expect(
    page.getByText('This intake policy does not approve any collaborator')
  ).toBeVisible();
  await expect(page.getByText('This page does not approve any partner')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Policy JSON' })).toHaveAttribute(
    'href',
    '/referral-partner-policy.json'
  );
  await expect(page.getByRole('link', { name: 'Sample Audit' })).toHaveAttribute(
    'href',
    '/services/sample-audit'
  );
});

test('operations page surfaces chairman queue and prospect batch', async ({ page }) => {
  await page.goto('/operations', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Reserve growth queue.' })).toBeVisible();
  await expect(page.getByText('500000 sats').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cycle Status' })).toBeVisible();
  await expect(page.getByText('999,500,000 sats')).toBeVisible();
  await expect(page.getByText('Ready Outreach Packets')).toBeVisible();
  await expect(
    page.locator('.metric').filter({ hasText: 'Inbound Invoice Requests' }).first()
  ).toBeVisible();
  await expect(page.getByText('Due Follow-Ups')).toBeVisible();
  await expect(page.getByText('Paid Campaigns')).toBeVisible();
  await expect(page.getByText('Promo Verification')).toBeVisible();
  await expect(page.getByText('Promo Measurement')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Target Math' })).toBeVisible();
  await expect(page.getByText('BTC/USD 100,000')).toBeVisible();
  await expect(page.getByText('Deals To 1B Sats').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'public/sats-target-plan.md' })).toHaveAttribute(
    'href',
    '/sats-target-plan.md'
  );
  await expect(page.getByRole('heading', { name: 'Attribution Links' })).toBeVisible();
  await expect(page.getByText('utm_source=x_142c').first()).toBeVisible();
  await expect(page.getByText('utm_source=manual_outreach').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inbound Lead Capture' })).toBeVisible();
  await expect(page.getByText('Live Sources', { exact: true })).toBeVisible();
  await expect(page.getByText('request-intake-fields')).toBeVisible();
  const intakeReplyTemplate = page
    .locator('.proof-block')
    .filter({ hasText: 'request-intake-fields' });
  await expect(
    intakeReplyTemplate.getByText(
      'https://sata-project-reserve.github.io/sata/services/transparency-audit#invoice-ready-intake'
    )
  ).toBeVisible();
  await expect(
    intakeReplyTemplate.getByText(
      'https://sata-project-reserve.github.io/sata/services/sample-audit'
    )
  ).toBeVisible();
  await expect(page.getByText('Paid promotion from @142C_')).toBeVisible();
  await expect(
    page.getByText('node scripts/inbound-service-lead-agent.mjs record-lead').first()
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inbound Invoice Requests' })).toBeVisible();
  await expect(page.getByText('npm run ops:inbound-invoice-request-plan')).toBeVisible();
  await expect(
    page.getByText(
      'No exact-sats invoice or payment instruction before Executive Chairman approval.'
    )
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settlement Options Brief' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settlement Brief' })).toHaveAttribute(
    'href',
    '/settlement-options-brief.md'
  );
  const settlementSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Settlement Options Brief' }) });
  await expect(settlementSection.getByText('implemented-for-all-service-templates')).toBeVisible();
  await expect(
    settlementSection.getByText(
      'Do not send a payment address or amount from this brief. Render a customer payment packet only after a chairman-approved exact-sats invoice.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(settlementSection.getByText('USDC on Solana', { exact: true })).toBeVisible();
  await expect(settlementSection.getByText('SOL', { exact: true })).toBeVisible();
  await expect(
    settlementSection.getByText('node scripts/sats-invoice-quote-agent.mjs write-draft').first()
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority Action Queue' })).toBeVisible();
  await expect(page.getByText('#1 manual-referral-handoff-send')).toBeVisible();
  const referralHandoffAction = page
    .locator('.proof-block')
    .filter({ hasText: '#1 manual-referral-handoff-send' });
  await expect(
    referralHandoffAction.getByText(
      'Send prepared no-upfront post-receipt referral terms to Diana Crypto and record sent evidence.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    referralHandoffAction.getByText(
      'node scripts/referral-partner-handoff-agent.mjs record-sent --campaign diana-crypto-20260903-transparency-tweet --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>" --messageHash 74e29eee62758fdd29be42b7ab2e2973f0abb150f49b71e7fe763f6ae54b6ac7'
    )
  ).toBeVisible();
  await expect(
    referralHandoffAction.getByRole('link', { name: 'public/referral-partner-handoff-packet.md' })
  ).toHaveAttribute('href', '/referral-partner-handoff-packet.md');
  await expect(page.getByText('#2 inbound-reply-triage-monitor')).toBeVisible();
  const replyTriageAction = page
    .locator('.proof-block')
    .filter({ hasText: '#2 inbound-reply-triage-monitor' });
  await expect(
    replyTriageAction.getByText(
      'Triage replies and DMs from live SATA attribution sources before cold outreach.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(replyTriageAction.getByText('npm run ops:inbound-reply-triage-plan')).toBeVisible();
  await expect(page.getByText('#4 manual-outreach-send')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Social Review Queue' })).toBeVisible();
  await expect(page.getByText('post-receipt-referral-partners', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'npm run social:agent -- approve-post --post post-receipt-referral-partners --confirmChairmanApproval "I am Executive Chairman and approve social post post-receipt-referral-partners"'
    )
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Approved Social Publishing Queue' })
  ).toBeVisible();
  const approvedSocialSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Approved Social Publishing Queue' }) });
  const approvedSocialBlock = approvedSocialSection
    .locator('.proof-block')
    .filter({ hasText: 'btc-reserve-first-tranche' })
    .filter({ hasText: 'Record Published URL' });
  await expect(
    approvedSocialBlock.getByText('btc-reserve-first-tranche', { exact: true })
  ).toBeVisible();
  await expect(
    approvedSocialBlock.getByText(
      'npm run social:agent -- record-published --post btc-reserve-first-tranche --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e'
    )
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next Social Publish Sheet' })).toBeVisible();
  const nextSocialPublishSheet = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Next Social Publish Sheet' }) });
  await expect(
    nextSocialPublishSheet.getByText('transparency-service-offer', { exact: true })
  ).toBeVisible();
  await expect(
    nextSocialPublishSheet.getByText('SATA offers $249 Transparency Audits').first()
  ).toBeVisible();
  await expect(
    nextSocialPublishSheet.getByText(
      '4f846ec83919ae496dbf55643f433fdcb7615ae3055c6c71b73d0faafc544448',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    nextSocialPublishSheet.getByText(
      'node scripts/social-publish-evidence-agent.mjs render-template --post transparency-service-offer --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4f846ec83919ae496dbf55643f433fdcb7615ae3055c6c71b73d0faafc544448'
    )
  ).toBeVisible();
  await expect(
    nextSocialPublishSheet.getByText('npm run ops:social-publish-evidence-plan')
  ).toBeVisible();
  await expect(
    nextSocialPublishSheet.getByText(
      'npm run social:agent -- record-published --post transparency-service-offer --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4f846ec83919ae496dbf55643f433fdcb7615ae3055c6c71b73d0faafc544448'
    )
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Social Dispatch Brief' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Social Dispatch Brief' })).toHaveAttribute(
    'href',
    '/social-dispatch-brief.md'
  );
  const socialDispatchSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Social Dispatch Brief' }) });
  const socialDispatchBlock = socialDispatchSection
    .locator('.proof-block')
    .filter({ hasText: 'btc-reserve-first-tranche' })
    .filter({ hasText: 'Approved Content SHA-256' });
  await expect(
    socialDispatchBlock.getByText(
      '4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    socialDispatchBlock.getByText('npm run ops:social-publish-evidence-plan')
  ).toBeVisible();
  await expect(
    socialDispatchBlock.getByText(
      'npm run social:agent -- record-published --post btc-reserve-first-tranche --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e'
    )
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paid Promotion Control' })).toBeVisible();
  await expect(page.getByText('completed').first()).toBeVisible();
  await expect(page.getByText('Awaiting 24h Measurement')).toBeVisible();
  const paidPromotionBlock = page
    .locator('.proof-block')
    .filter({ hasText: 'Reported Post' })
    .filter({ hasText: 'Diana Crypto @142C_' });
  await expect(paidPromotionBlock.getByText('Diana Crypto @142C_', { exact: true })).toBeVisible();
  await expect(
    paidPromotionBlock.getByText(
      'Convert this zero-receipt promotion into a no-upfront post-receipt referral handoff before considering repeat spend.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    paidPromotionBlock.getByText('https://x.com/142C_/status/2086570576530010172', {
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByText('Confirmed Promo Receipts')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Referral Partner Policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Referral Handoff Queue' })).toBeVisible();
  const referralHandoffCandidateBlock = page
    .locator('.proof-block')
    .filter({ hasText: 'post-receipt candidate' })
    .filter({ hasText: 'Diana Crypto @142C_' });
  await expect(
    referralHandoffCandidateBlock.getByText('Write Packet', { exact: true })
  ).toBeVisible();
  await expect(
    referralHandoffCandidateBlock.getByText(
      'node scripts/referral-partner-handoff-agent.mjs write-packet --campaign diana-crypto-20260903-transparency-tweet'
    )
  ).toBeVisible();
  await expect(
    referralHandoffCandidateBlock.getByRole('link', {
      name: 'public/referral-partner-handoff-packet.md'
    })
  ).toHaveAttribute('href', '/referral-partner-handoff-packet.md');
  await expect(
    referralHandoffCandidateBlock.getByText(
      'node scripts/referral-partner-handoff-agent.mjs record-sent --campaign diana-crypto-20260903-transparency-tweet --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>" --messageHash 74e29eee62758fdd29be42b7ab2e2973f0abb150f49b71e7fe763f6ae54b6ac7'
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      'Approved post-receipt partner compensation policy ready for gated referral packet generation.'
    )
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Referral Partners' })).toHaveAttribute(
    'href',
    '/partners/referrals'
  );
  await expect(page.getByRole('link', { name: 'Referral Handoff Brief' })).toHaveAttribute(
    'href',
    '/referral-handoff-dispatch-brief.md'
  );
  const referralPolicyBlock = page
    .locator('.proof-block')
    .filter({ hasText: 'draft-referral-partner-policy' });
  await expect(
    referralPolicyBlock.getByText('post-receipt-referral-partner-policy', { exact: true })
  ).toBeVisible();
  await expect(referralPolicyBlock.getByText('npm run ops:referral-policy-check')).toBeVisible();
  await expect(referralPolicyBlock.getByText('Partner Packet', { exact: true })).toBeVisible();
  await expect(referralPolicyBlock.getByText('npm run ops:referral-packet-plan')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next Manual Send Sheet' })).toBeVisible();
  const nextSendSheet = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Next Manual Send Sheet' }) });
  await expect(
    nextSendSheet.getByText(
      'Single-packet path from approved outreach copy to auditable contact evidence.'
    )
  ).toBeVisible();
  await expect(nextSendSheet.getByText('sanctum-elysium-loam').first()).toBeVisible();
  await expect(nextSendSheet.getByText('send next', { exact: true })).toBeVisible();
  await expect(
    nextSendSheet.getByText(
      'outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    nextSendSheet.getByText(
      'Send the exact approved message only, submit durable evidence, run evidence review, then record only with the verified command before reply review.'
    )
  ).toBeVisible();
  await expect(
    nextSendSheet
      .getByText('b5fd3c92884794a7d032a10244fa442d841ead2a948b2c08d86ffd07128e4b98')
      .first()
  ).toBeVisible();
  await expect(
    nextSendSheet.getByText(
      'node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"'
    )
  ).toBeVisible();
  await expect(nextSendSheet.getByText('npm run ops:outreach-contact-evidence-plan')).toBeVisible();
  await expect(
    nextSendSheet.getByText(
      'node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash b5fd3c92884794a7d032a10244fa442d841ead2a948b2c08d86ffd07128e4b98'
    )
  ).toBeVisible();
  await expect(nextSendSheet.getByText('Contact Evidence Issue Body')).toBeVisible();
  await expect(
    nextSendSheet
      .locator('.preview')
      .filter({ hasText: '### Outreach packet ID' })
      .filter({
        hasText: 'outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact'
      })
      .filter({ hasText: '### Exact message sent' })
      .filter({ hasText: '### Sent at UTC' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manual Outreach Packets' })).toBeVisible();
  await expect(page.getByText('Showing 5 of 30 ready packets.')).toBeVisible();
  await expect(page.getByText('Sprint Gross Target')).toBeVisible();
  await expect(page.getByText('$1,245')).toBeVisible();
  await expect(page.getByText('Reserve Allocation Target')).toBeVisible();
  await expect(page.getByText('$871.50 at 70%')).toBeVisible();
  await expect(page.getByText('Planning Reserve Impact')).toBeVisible();
  await expect(page.getByText('871500 sats')).toBeVisible();
  await expect(page.getByText('Get one explicit invoice request')).toBeVisible();
  await expect(
    page.getByText(
      'manual_outreach:outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact'
    )
  ).toBeVisible();
  await expect(
    page
      .getByText('outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact', {
        exact: true
      })
      .first()
  ).toBeVisible();
  await expect(
    page
      .locator('.preview')
      .filter({ hasText: 'Hi sanctum-elysium-loam' })
      .filter({ hasText: 'SATA runs a $249 Transparency Audit for crypto teams.' })
      .filter({ hasText: '#invoice-ready-intake' })
      .first()
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reply Conversion' })).toBeVisible();
  await expect(page.getByText('Invoice Conversion Sprint')).toBeVisible();
  await expect(page.getByText('awaiting-manual-contact-send')).toBeVisible();
  await expect(page.getByText('Qualified Path Impact')).toBeVisible();
  await expect(page.getByText('699300 sats')).toBeVisible();
  await expect(page.getByRole('link', { name: 'contact evidence intake' })).toHaveAttribute(
    'href',
    'https://github.com/sata-project-reserve/sata/issues/new?template=outreach-contact-evidence.yml'
  );
  await expect(page.getByText('Approved Message SHA-256').first()).toBeVisible();
  await expect(page.getByText('Prepare Evidence Issue').first()).toBeVisible();
  await expect(
    page
      .getByText(
        'node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"'
      )
      .first()
  ).toBeVisible();
  await expect(
    page
      .getByText(
        'node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash b5fd3c92884794a7d032a10244fa442d841ead2a948b2c08d86ffd07128e4b98'
      )
      .first()
  ).toBeVisible();
  await expect(
    page.getByText('No contacted prospects or invoice requests are recorded yet.')
  ).toBeVisible();
  await expect(page.getByText('outreach-approved').first()).toBeVisible();
  await expect(page.getByText('No price guarantee').first()).toBeVisible();
});
