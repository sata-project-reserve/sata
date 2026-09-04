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
  await expect(page.getByRole('heading', { name: 'Upgrade Path' })).toBeVisible();
  await expect(page.getByText('Offer the $300 full proof dashboard only')).toBeVisible();
  await expect(page.getByText('No price guarantee')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact @SATAReserve' })).toBeVisible();
});

test('operations page surfaces chairman queue and prospect batch', async ({ page }) => {
  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: 'Reserve growth queue.' })).toBeVisible();
  await expect(page.getByText('500000 sats').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cycle Status' })).toBeVisible();
  await expect(page.getByText('999,500,000 sats')).toBeVisible();
  await expect(page.getByText('Ready Outreach Packets')).toBeVisible();
  await expect(page.getByText('Due Follow-Ups')).toBeVisible();
  await expect(page.getByText('Paid Campaigns')).toBeVisible();
  await expect(page.getByText('Promo Verification')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Priority Action Queue' })).toBeVisible();
  await expect(page.getByText('#1 manual-outreach-send')).toBeVisible();
  await expect(page.getByText('#2 manual-outreach-send')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Social Review Queue' })).toBeVisible();
  await expect(page.getByText('No social posts are waiting for chairman review.')).toBeVisible();
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
  await expect(page.getByText('live-verified').first()).toBeVisible();
  await expect(page.getByText('Awaiting 24h Measurement')).toBeVisible();
  await expect(
    page.getByText(
      'node scripts/paid-promotion-agent.mjs record-conversion --campaign diana-crypto-20260903-transparency-tweet --evidence "<24h-analytics-and-inquiry-log>" --profileViewLift "<profile-view-change-or-not-recorded>" --trackedClicks 0 --serviceInquiries 0 --invoiceRequests 0 --confirmedReceiptsSats 0'
    )
  ).toBeVisible();
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
  const referralPolicyBlock = page
    .locator('.proof-block')
    .filter({ hasText: 'draft-referral-partner-policy' });
  await expect(
    referralPolicyBlock.getByText('post-receipt-referral-partner-policy', { exact: true })
  ).toBeVisible();
  await expect(referralPolicyBlock.getByText('npm run ops:referral-policy-check')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manual Outreach Packets' })).toBeVisible();
  await expect(page.getByText('Showing 5 of 30 ready packets.')).toBeVisible();
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
