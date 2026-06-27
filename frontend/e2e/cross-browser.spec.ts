import { test, expect, Page } from '@playwright/test';

/**
 * Cross-browser E2E tests for VoteChain.
 *
 * These tests run on Chromium, Firefox, and WebKit and verify that core
 * user flows, layout, and interactive functionality behave consistently.
 *
 * Design principles for stability across browsers:
 *   - Use semantic/role selectors and stable CSS classes from proposals.spec.ts
 *   - Avoid assertions that depend on browser-specific timing or animation
 *   - Use waitFor / toBeVisible with explicit timeouts where needed
 *   - Do not assert pixel-exact layout — assert structural presence instead
 *   - The Freighter wallet mock is injected the same way as proposals.spec.ts
 */

/** Inject the Freighter wallet mock — identical to proposals.spec.ts. */
async function mockFreighter(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).freighter = {
      isConnected:    () => Promise.resolve(true),
      getPublicKey:   () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
      getNetwork:     () => Promise.resolve('TESTNET'),
      requestAccess:  () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
      signTransaction: (_xdr: string, _opts: unknown) => Promise.resolve('signed_xdr_placeholder'),
    };
  });
}

// ── Suite 1: Page load & structure ───────────────────────────────────────────

test.describe('Page load and structure', () => {
  test.beforeEach(async ({ page }) => {
    await mockFreighter(page);
    await page.goto('/');
  });

  test('renders page title', async ({ page }) => {
    await expect(page).toHaveTitle(/VoteChain/);
  });

  test('renders main heading', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('renders proposal cards', async ({ page }) => {
    const cards = page.locator('.proposal-card');
    await expect(cards.first()).toBeVisible();
    // At least one card must be present
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('renders wallet connect button', async ({ page }) => {
    await expect(page.locator('#wallet-connect-btn')).toBeVisible();
  });

  test('renders state filter buttons', async ({ page }) => {
    // At least one filter button should be present
    await expect(page.locator('.filter-btn').first()).toBeVisible();
  });
});

// ── Suite 2: Navigation and layout ───────────────────────────────────────────

test.describe('Navigation and layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockFreighter(page);
    await page.goto('/');
  });

  test('skip-link is present in DOM', async ({ page }) => {
    // Accessibility: skip link must exist (WCAG 2.4.1) even if visually hidden
    const skipLink = page.locator('a.skip-link, a[href="#main-content"]');
    await expect(skipLink).toHaveCount(1);
  });

  test('main content region is present', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('navbar is visible', async ({ page }) => {
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();
  });
});

// ── Suite 3: Proposal filtering ───────────────────────────────────────────────

test.describe('Proposal filtering', () => {
  test.beforeEach(async ({ page }) => {
    await mockFreighter(page);
    await page.goto('/');
  });

  test('filter buttons are interactive', async ({ page }) => {
    const firstFilter = page.locator('.filter-btn').first();
    await expect(firstFilter).toBeEnabled();
    await firstFilter.click();
    // After click, button should still be in the DOM (not navigate away)
    await expect(firstFilter).toBeVisible();
  });

  test('Passed filter shows only Passed badges', async ({ page }) => {
    const passedBtn = page.locator('.filter-btn', { hasText: 'Passed' });
    // Only assert if the Passed filter exists
    if (await passedBtn.count() === 0) return;

    await passedBtn.click();
    const badges = page.locator('.state-badge');
    const count = await badges.count();
    if (count === 0) return; // No passed proposals — acceptable

    const texts = await badges.allTextContents();
    for (const text of texts) {
      expect(text.trim()).toBe('Passed');
    }
  });
});

// ── Suite 4: Wallet connection ────────────────────────────────────────────────

test.describe('Wallet connection', () => {
  test.beforeEach(async ({ page }) => {
    await mockFreighter(page);
    await page.goto('/');
  });

  test('connect button changes label after connection', async ({ page }) => {
    const btn = page.locator('#wallet-connect-btn');
    await expect(btn).toBeVisible();

    const initialText = await btn.textContent();
    await btn.click();

    // After connect, label must change (show address or connected state)
    await expect(btn).not.toHaveText(initialText ?? '', { timeout: 5000 });
  });
});

// ── Suite 5: Responsive layout ────────────────────────────────────────────────

test.describe('Responsive layout', () => {
  const viewports = [
    { name: 'mobile',  width: 375,  height: 812 },
    { name: 'tablet',  width: 768,  height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`proposal list renders at ${vp.name} (${vp.width}×${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockFreighter(page);
      await page.goto('/');

      // Core structural elements must be present at every viewport
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('.proposal-card').first()).toBeVisible();
    });
  }
});
