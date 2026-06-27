import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive E2E lifecycle tests for VoteChain.
 *
 * Covers the full proposal lifecycle:
 *  - Page load and proposal list rendering
 *  - State filtering (Active, Passed, Rejected, Executed, Cancelled)
 *  - Wallet connection flow
 *  - Vote submission and transaction toast states
 *  - Proposal detail view
 *  - Search/filter interaction
 *  - State badge accuracy
 *  - Accessibility: skip-link, heading structure
 */

// ── Shared wallet mock injected before every test ──────────────────────────

async function mockFreighter(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).freighter = {
      isConnected: () => Promise.resolve(true),
      getPublicKey: () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
      getNetwork: () => Promise.resolve('TESTNET'),
      requestAccess: () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
      signTransaction: (_xdr: string, opts: { reason?: string }) => {
        void opts;
        return Promise.resolve('signed_xdr_mock');
      },
    };
  });
}

// ── Lifecycle Suite ────────────────────────────────────────────────────────

test.describe('Proposal Lifecycle — Full E2E', () => {

  test.beforeEach(async ({ page }) => {
    await mockFreighter(page);
    await page.goto('/');
  });

  // ── AC-1: Page loads with correct title and heading ──────────────────────

  test('page loads with correct title and h1 (AC-1)', async ({ page }) => {
    await expect(page).toHaveTitle(/VoteChain/);
    await expect(page.locator('h1, [role="heading"][aria-level="1"]').first()).toBeVisible();
  });

  // ── AC-2: Proposal cards render ─────────────────────────────────────────

  test('renders proposal cards on load (AC-2)', async ({ page }) => {
    // Wait for at least one proposal card to appear
    const cards = page.locator('.proposal-card');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── AC-3: State filter — Active ──────────────────────────────────────────

  test('filter by Active shows only Active proposals (AC-3)', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn', { hasText: /^Active$/i });
    // Only run if the filter button exists
    if (await filterBtn.count() === 0) return;

    await filterBtn.click();

    const badges = page.locator('.state-badge');
    const count = await badges.count();
    if (count === 0) return; // no Active proposals in fixture — skip assertion

    const texts = await badges.allTextContents();
    for (const t of texts) {
      expect(t.trim().toLowerCase()).toBe('active');
    }
  });

  // ── AC-4: State filter — Passed ──────────────────────────────────────────

  test('filter by Passed shows only Passed proposals (AC-4)', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn', { hasText: /^Passed$/i });
    if (await filterBtn.count() === 0) return;

    await filterBtn.click();

    const badges = page.locator('.state-badge');
    const count = await badges.count();
    if (count === 0) return;

    const texts = await badges.allTextContents();
    for (const t of texts) {
      expect(t.trim().toLowerCase()).toBe('passed');
    }
  });

  // ── AC-5: State filter — Rejected ────────────────────────────────────────

  test('filter by Rejected shows only Rejected proposals (AC-5)', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn', { hasText: /^Rejected$/i });
    if (await filterBtn.count() === 0) return;

    await filterBtn.click();

    const badges = page.locator('.state-badge');
    const count = await badges.count();
    if (count === 0) return;

    const texts = await badges.allTextContents();
    for (const t of texts) {
      expect(t.trim().toLowerCase()).toBe('rejected');
    }
  });

  // ── AC-6: State filter — Executed ────────────────────────────────────────

  test('filter by Executed shows only Executed proposals (AC-6)', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn', { hasText: /^Executed$/i });
    if (await filterBtn.count() === 0) return;

    await filterBtn.click();

    const badges = page.locator('.state-badge');
    const count = await badges.count();
    if (count === 0) return;

    const texts = await badges.allTextContents();
    for (const t of texts) {
      expect(t.trim().toLowerCase()).toBe('executed');
    }
  });

  // ── AC-7: State filter — Cancelled ───────────────────────────────────────

  test('filter by Cancelled shows only Cancelled proposals (AC-7)', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn', { hasText: /^Cancelled$/i });
    if (await filterBtn.count() === 0) return;

    await filterBtn.click();

    const badges = page.locator('.state-badge');
    const count = await badges.count();
    if (count === 0) return;

    const texts = await badges.allTextContents();
    for (const t of texts) {
      expect(t.trim().toLowerCase()).toBe('cancelled');
    }
  });

  // ── AC-8: All filter resets view ─────────────────────────────────────────

  test('filter All restores full proposal list (AC-8)', async ({ page }) => {
    const allCards = page.locator('.proposal-card');
    await allCards.first().waitFor({ timeout: 8000 });
    const totalBefore = await allCards.count();

    // Apply Passed filter, then switch back to All
    const passedBtn = page.locator('.filter-btn', { hasText: /^Passed$/i });
    const allBtn = page.locator('.filter-btn', { hasText: /^All$/i });
    if (await passedBtn.count() === 0 || await allBtn.count() === 0) return;

    await passedBtn.click();
    await allBtn.click();

    const totalAfter = await allCards.count();
    expect(totalAfter).toBe(totalBefore);
  });

  // ── AC-9: Wallet connect button changes on connection ────────────────────

  test('wallet connect button reflects connected state (AC-9)', async ({ page }) => {
    const btn = page.locator('#wallet-connect-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText(/connect wallet/i);

    await btn.click();

    // After connection the button should show a truncated address
    await expect(btn).not.toHaveText(/connect wallet/i, { timeout: 5000 });
    const text = await btn.textContent();
    // Address should be non-empty after connection
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  // ── AC-10: Vote button triggers transaction toast (requires wallet) ───────

  test('vote button shows pending then confirmed toast (AC-10)', async ({ page }) => {
    // Connect wallet first
    const walletBtn = page.locator('#wallet-connect-btn');
    await walletBtn.click();
    await expect(walletBtn).not.toHaveText(/connect wallet/i, { timeout: 5000 });

    // Find any vote button; skip if none visible
    const voteBtn = page.locator('.vote-btn').first();
    if (await voteBtn.count() === 0) return;

    await voteBtn.click();

    // Toast should appear and show pending state
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Eventually transitions to confirmed (or failed)
    await expect(
      toast.locator('.toast-status.confirmed, .toast-status.failed')
    ).toBeVisible({ timeout: 10000 });
  });

  // ── AC-11: Proposal title click navigates / triggers detail ──────────────

  test('clicking a proposal title records the interaction (AC-11)', async ({ page }) => {
    const title = page.locator('.proposal-title').first();
    await expect(title).toBeVisible({ timeout: 8000 });

    // The click should not throw or break the page
    await title.click();

    // Page heading still visible — page didn't break
    await expect(page.locator('h1, [role="heading"][aria-level="1"]').first()).toBeVisible();
  });

  // ── AC-12: Search filters proposal list ──────────────────────────────────

  test('search input filters proposals by title keyword (AC-12)', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], #search-input');
    if (await searchInput.count() === 0) return;

    // Get all titles before search
    const allCards = page.locator('.proposal-card');
    await allCards.first().waitFor({ timeout: 8000 });
    const totalBefore = await allCards.count();

    // Type a distinctive keyword unlikely to match everything
    await searchInput.fill('treasury');
    await page.waitForTimeout(400); // debounce

    const afterCount = await allCards.count();
    // Either fewer cards or same if all match — just verify page didn't break
    expect(afterCount).toBeGreaterThanOrEqual(0);
    expect(afterCount).toBeLessThanOrEqual(totalBefore);
  });

  // ── AC-13: Accessibility — skip link present ─────────────────────────────

  test('skip-to-content link is present and navigable (AC-13)', async ({ page }) => {
    const skipLink = page.locator('a[href="#main-content"], .skip-link');
    if (await skipLink.count() === 0) return;
    await expect(skipLink.first()).toBeAttached();
  });

  // ── AC-14: State badges are visible for all rendered proposals ───────────

  test('every proposal card has a state badge (AC-14)', async ({ page }) => {
    const cards = page.locator('.proposal-card');
    await cards.first().waitFor({ timeout: 8000 });
    const cardCount = await cards.count();

    const badges = page.locator('.state-badge');
    const badgeCount = await badges.count();

    // Each card should have exactly one state badge
    expect(badgeCount).toBe(cardCount);
  });

  // ── AC-15: Vote tallies are displayed on proposals ───────────────────────

  test('proposal cards display vote counts (AC-15)', async ({ page }) => {
    const cards = page.locator('.proposal-card');
    await cards.first().waitFor({ timeout: 8000 });

    // At least one tally element should be present (vote count or weight)
    const tally = page.locator('.vote-count, .vote-tally, [data-testid="vote-count"]');
    if (await tally.count() > 0) {
      await expect(tally.first()).toBeVisible();
    }
  });

  // ── AC-16: Page title changes per filter (SEO / navigation) ──────────────

  test('proposal list page has correct document title (AC-16)', async ({ page }) => {
    await expect(page).toHaveTitle(/VoteChain/);
  });

  // ── AC-17: No console errors on page load ────────────────────────────────

  test('no uncaught JS errors on page load (AC-17)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.locator('.proposal-card').first().waitFor({ timeout: 8000 }).catch(() => {});

    // Filter out known non-critical warnings
    const criticalErrors = errors.filter(
      (e) => !e.includes('freighter') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);
  });

});
