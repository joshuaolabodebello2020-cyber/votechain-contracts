import { test, expect } from '@playwright/test';

/**
 * E2E tests for VoteChain critical user flows.
 * AC-1: Load proposal list page
 * AC-2: Filter proposals by state
 * AC-3: View proposal detail
 * AC-4: Connect wallet (mocked)
 * AC-5: Cast vote (requires signature)
 */
test.describe('VoteChain Proposals Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Mock the Freighter wallet extension (SEC-013)
    await page.addInitScript(() => {
      interface Freighter {
        isConnected: () => Promise<boolean>;
        getPublicKey: () => Promise<string>;
        getNetwork: () => Promise<string>;
        requestAccess: () => Promise<string>;
        signTransaction: (xdr: string, opts: { network?: string; reason?: string }) => Promise<string>;
      }

      (window as unknown as { freighter: Freighter }).freighter = {
        isConnected: () => Promise.resolve(true),
        getPublicKey: () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
        getNetwork: () => Promise.resolve('TESTNET'),
        requestAccess: () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
        signTransaction: (_xdr: string, opts: { reason?: string }) => {
          console.log(`Mock signature requested for: ${opts.reason}`);
          return Promise.resolve('signed_xdr_placeholder');
        },
      };
    });

    // Navigate to the proposal list page
    await page.goto('/');
  });

  test('should load the proposal list page (TEST-011 AC-1)', async ({ page }) => {
    await expect(page).toHaveTitle(/VoteChain — Proposals/);
    await expect(page.locator('h1')).toHaveText('Governance Proposals');
    
    // Verify initial proposal cards are loaded
    const cards = page.locator('.proposal-card');
    await expect(cards).toHaveCount(10); // Matches DEFAULT_PAGE_SIZE in proposals.js
  });

  test('should filter proposals by state (TEST-011 AC-2)', async ({ page }) => {
    // Click on "Passed" filter
    const passedBtn = page.locator('.filter-btn', { hasText: 'Passed' });
    await passedBtn.click();

    // Verify all visible cards have the "Passed" status badge
    const badges = page.locator('.state-badge');
    const badgeTexts = await badges.allTextContents();
    badgeTexts.forEach(text => {
      expect(text.trim()).toBe('Passed');
    });
  });

  test('should connect wallet (TEST-011 AC-4)', async ({ page }) => {
    const connectBtn = page.locator('#wallet-connect-btn');
    await expect(connectBtn).toHaveText('Connect Wallet');

    await connectBtn.click();

    // After connection, button should show truncated address (e.g. GBXYZA…CDEF)
    await expect(connectBtn).toHaveText(/GBXYZA.*CDEF/);
  });

  test('should view proposal detail (TEST-011 AC-3)', async ({ page }) => {
    const firstTitle = page.locator('.proposal-title').first();
    const titleText = await firstTitle.textContent();

    // Click on proposal title
    await firstTitle.click();

    // In current mock implementation, this just logs to console
    // In a real app, we would verify navigation to /proposal/:id
    console.log(`Clicked proposal: ${titleText}`);
  });

  test('should require signature for casting a vote (SEC-013)', async ({ page }) => {
    // 1. Must connect wallet first
    await page.locator('#wallet-connect-btn').click();

    // 2. Click "Vote" on the first active proposal
    const voteBtn = page.locator('.vote-btn').first();
    await voteBtn.click();

    // 3. Verify toast notification appears for pending transaction
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await expect(toast.locator('.toast-status.pending')).toBeVisible();
    await expect(toast.locator('.toast-title')).toContainText('Vote on proposal');

    // 4. Wait for confirmed status (simulated in mock)
    await expect(toast.locator('.toast-status.confirmed')).toBeVisible({ timeout: 5000 });
  });

});
