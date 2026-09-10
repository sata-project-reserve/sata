import { expect, test } from '@playwright/test';

test('dashboard renders wallet safety status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SATA Token Launcher' })).toBeVisible();
  await expect(page.getByText(/Mainnet: (locked|unlocked)/)).toBeVisible();
  await expect(page.getByText('Signing must occur inside MetaMask')).toBeVisible();
});

test('token form displays base-unit supply', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Configure token/ }).click();
  await expect(page.getByText('Base-unit supply: 1000000000000000000')).toBeVisible();
});

test('liquidity planner exposes permanent LP lock controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Liquidity planner/ }).click();
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
  await expect(page.locator('.service-primary-metric')).toContainText('$50');
  await expect(page.locator('.service-primary-metric')).toContainText('24-hour target');
  await expect(
    page.getByRole('article').filter({ hasText: 'Transparency audit for crypto teams' })
  ).toContainText('$50');
  await expect(page.getByRole('heading', { name: 'Payment Path' })).toBeVisible();
  await expect(page.getByText('BTC to the published reserve address')).toBeVisible();
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
  await expect(page.getByText('Offer the $300 full proof dashboard only')).toBeVisible();
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

test('sample transparency audit page publishes fictional deliverable boundaries', async ({ page }) => {
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
  await expect(page.locator('.service-primary-metric')).toContainText('$150');
  await expect(page.getByRole('heading', { name: 'Payment Gate' })).toBeVisible();
  await expect(page.getByText('Executive Chairman approves final scope and invoice')).toBeVisible();
  await expect(page.getByText('No agent receives funds, controls keys, or approves spending')).toBeVisible();
  await expect(page.getByText('No price guarantee')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start With Audit' })).toHaveAttribute(
    'href',
    '/services/transparency-audit'
  );

  await page.goto('/services/full-proof-dashboard');
  await expect(page.getByRole('heading', { name: 'Full proof dashboard setup.' })).toBeVisible();
  await expect(page.locator('.service-primary-metric')).toContainText('$300');
  await expect(page.getByText('Public JSON endpoints for independent verification')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revenue Use' })).toBeVisible();
  await expect(page.getByText('No market-support')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request Dashboard' })).toBeVisible();
});

test('referral partner page publishes post-receipt gates', async ({ page }) => {
  await page.goto('/partners/referrals', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Post-receipt referral partners.' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Attribution Links' })).toBeVisible();
  await expect(page.getByText('utm_source=x_142c').first()).toBeVisible();
  await expect(page.getByText('utm_source=manual_outreach').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inbound Lead Capture' })).toBeVisible();
  await expect(page.getByText('Live Sources', { exact: true })).toBeVisible();
  await expect(page.getByText('request-intake-fields')).toBeVisible();
  await expect(page.getByText('Paid promotion from @142C_')).toBeVisible();
  await expect(
    page.getByText('node scripts/inbound-service-lead-agent.mjs record-lead').first()
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inbound Invoice Requests' })).toBeVisible();
  await expect(page.getByText('npm run ops:inbound-invoice-request-plan')).toBeVisible();
  await expect(
    page.getByText('No exact-sats invoice or payment instruction before Executive Chairman approval.')
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority Action Queue' })).toBeVisible();
  await expect(page.getByText('#1 manual-outreach-send')).toBeVisible();
  await expect(page.getByText('#2 manual-outreach-send')).toBeVisible();
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
  const approvedSocialBlock = page
    .locator('.proof-block')
    .filter({ hasText: 'btc-reserve-first-tranche' })
    .filter({ hasText: 'Record Published URL' });
  await expect(approvedSocialBlock.getByText('btc-reserve-first-tranche', { exact: true })).toBeVisible();
  await expect(
    approvedSocialBlock.getByText(
      'npm run social:agent -- record-published --post btc-reserve-first-tranche --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>"'
    )
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paid Promotion Control' })).toBeVisible();
  await expect(page.getByText('Diana Crypto @142C_')).toBeVisible();
  await expect(page.getByText('completed').first()).toBeVisible();
  await expect(page.getByText('Awaiting 24h Measurement')).toBeVisible();
  await expect(page.getByText('Do not repeat paid promotion unless')).toBeVisible();
  const paidPromotionBlock = page
    .locator('.proof-block')
    .filter({ hasText: 'Diana Crypto @142C_' });
  await expect(
    paidPromotionBlock.getByText('https://x.com/142C_/status/2086570576530010172', {
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByText('Confirmed Promo Receipts')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Referral Partner Policy' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Referral Partners' })).toHaveAttribute(
    'href',
    '/partners/referrals'
  );
  const referralPolicyBlock = page
    .locator('.proof-block')
    .filter({ hasText: 'draft-referral-partner-policy' });
  await expect(
    referralPolicyBlock.getByText('post-receipt-referral-partner-policy', { exact: true })
  ).toBeVisible();
  await expect(referralPolicyBlock.getByText('npm run ops:referral-policy-check')).toBeVisible();
  await expect(referralPolicyBlock.getByText('Partner Packet')).toBeVisible();
  await expect(referralPolicyBlock.getByText('npm run ops:referral-packet-plan')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manual Outreach Packets' })).toBeVisible();
  await expect(page.getByText('Showing 5 of 30 ready packets.')).toBeVisible();
  await expect(page.getByText('Sprint Gross Target')).toBeVisible();
  await expect(page.getByText('$250')).toBeVisible();
  await expect(page.getByText('Reserve Allocation Target')).toBeVisible();
  await expect(page.getByText('$175 at 70%')).toBeVisible();
  await expect(page.getByText('Planning Reserve Impact')).toBeVisible();
  await expect(page.getByText('175000 sats')).toBeVisible();
  await expect(page.getByText('Get one explicit invoice request')).toBeVisible();
  await expect(
    page.getByText(
      'manual_outreach:outreach-packet-20260831-arnold-solana-transparency-audit-first-contact'
    )
  ).toBeVisible();
  await expect(
    page.getByText('outreach-packet-20260831-arnold-solana-transparency-audit-first-contact', {
      exact: true
    }).first()
  ).toBeVisible();
  await expect(
    page
      .locator('.preview')
      .filter({ hasText: 'Hi arnold-solana' })
      .filter({ hasText: 'SATA runs a small transparency audit service for crypto teams.' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reply Conversion' })).toBeVisible();
  await expect(
    page.getByText(
      'node scripts/sats-prospect-response-agent.mjs record-contacted --prospect arnold-solana --evidence "<contact-evidence-url-or-reference>" --channel "manual-dm-or-email"'
    )
  ).toBeVisible();
  await expect(
    page.getByText('No contacted prospects or invoice requests are recorded yet.')
  ).toBeVisible();
  await expect(page.getByText('outreach-approved').first()).toBeVisible();
  await expect(page.getByText('No price guarantee').first()).toBeVisible();
});
