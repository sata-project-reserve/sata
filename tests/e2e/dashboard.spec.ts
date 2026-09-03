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
  await expect(page.getByText('No price guarantee')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact @SATAReserve' })).toBeVisible();
});

test('operations page surfaces chairman queue and prospect batch', async ({ page }) => {
  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: 'Reserve growth queue.' })).toBeVisible();
  await expect(page.getByText('500000 sats')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cycle Status' })).toBeVisible();
  await expect(page.getByText('999,500,000 sats')).toBeVisible();
  await expect(page.locator('.notice').filter({ hasText: 'Next Action' })).toContainText(
    'Verify paid promotion campaign diana-crypto-20260903-transparency-tweet before counting it live or approving repeat spend.'
  );
  await expect(page.getByText('outreach-approved').locator('..').getByText('30')).toBeVisible();
  await expect(page.getByText('Ready Outreach Packets').locator('..').getByText('30')).toBeVisible();
  await expect(page.getByText('Due Follow-Ups').locator('..').getByText('0')).toBeVisible();
  await expect(page.getByText('Paid Campaigns').locator('..').getByText('1')).toBeVisible();
  await expect(page.getByText('Promo Verification').locator('..').getByText('1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority Action Queue' })).toBeVisible();
  await expect(page.getByText('#1 paid-promotion-verification')).toBeVisible();
  await expect(
    page.getByText(
      'Verify paid promotion campaign diana-crypto-20260903-transparency-tweet before counting it live or approving repeat spend.'
    ).first()
  ).toBeVisible();
  await expect(page.getByText('#2 manual-outreach-send')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paid Promotion Control' })).toBeVisible();
  await expect(page.getByText('Diana Crypto @142C_')).toBeVisible();
  await expect(page.getByText('post-reported-unverified')).toBeVisible();
  await expect(page.getByText('2086570576530010172')).toBeVisible();
  await expect(
    page
      .locator('.metric')
      .filter({ hasText: 'Confirmed Promo Receipts' })
      .filter({ hasText: '0 sats' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manual Outreach Packets' })).toBeVisible();
  await expect(
    page.getByText('outreach-packet-20260831-arnold-solana-transparency-audit-first-contact', {
      exact: true
    })
  ).toBeVisible();
  await expect(
    page
      .locator('.preview')
      .filter({ hasText: 'Hi arnold-solana' })
      .filter({ hasText: 'SATA runs a small transparency audit service for crypto teams.' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reply Conversion' })).toBeVisible();
  await expect(page.getByText('after approved outreach is sent')).toHaveCount(30);
  await expect(
    page.getByText(
      'node scripts/sats-prospect-response-agent.mjs record-contacted --prospect arnold-solana'
    )
  ).toBeVisible();
  await expect(
    page.getByText('No contacted prospects or invoice requests are recorded yet.')
  ).toBeVisible();
  await expect(
    page
      .locator('.summary-grid .metric')
      .filter({ has: page.getByText('identified', { exact: true }) })
      .filter({ has: page.getByText('0', { exact: true }) })
  ).toBeVisible();
  await expect(
    page
      .locator('.summary-grid .metric')
      .filter({ has: page.getByText('chairman-review', { exact: true }) })
      .filter({ has: page.getByText('0', { exact: true }) })
  ).toBeVisible();
  await expect(
    page
      .locator('.summary-grid .metric')
      .filter({ has: page.getByText('outreach-approved', { exact: true }) })
      .filter({ has: page.getByText('30', { exact: true }) })
  ).toBeVisible();
  const manualOutreachSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Manual Outreach Packets' })
  });
  for (const prospect of [
    'roach-solana',
    'tradiecoin',
    'fyborg',
    'ssqueeze',
    'foxclub',
    'lastshift',
    'kerythos-kyrt',
    'lilmeme',
    'modest-money',
    'funtom',
    'spcx',
    'ansem-season',
    'meor',
    'solana-mint-forge',
    'niulai',
    'honk-solana',
    'bonkwifhat-bif',
    'bitdust',
    'sanctum-elysium-loam',
    'instar-meme-futures',
    'cia-token',
    'kedol-token',
    'meme-launch',
    'pippin-smc',
    'limelight-launchpad',
    'troptionsmint',
    'soltokenlab'
  ]) {
    await expect(manualOutreachSection.getByText(prospect, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Next Review Batch' })).toBeVisible();
  await expect(page.getByText('No price guarantee')).toBeVisible();
});
