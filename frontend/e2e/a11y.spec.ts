import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated WCAG 2.1 AA accessibility tests for VoteChain.
 *
 * Each test scans a page or interactive state with axe-core and fails
 * if any critical or serious violations are found.
 *
 * Rules applied: wcag2a, wcag2aa, wcag21a, wcag21aa
 *
 * To run locally:
 *   cd frontend
 *   npx playwright test e2e/a11y.spec.ts
 *
 * To view the full violation report:
 *   npx playwright show-report
 */

/** Inject the Freighter wallet mock so wallet-gated UI renders fully. */
async function mockFreighter(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).freighter = {
      isConnected:     () => Promise.resolve(true),
      getPublicKey:    () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
      getNetwork:      () => Promise.resolve('TESTNET'),
      requestAccess:   () => Promise.resolve('GBXYZABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF'),
      signTransaction: (_xdr: string, _opts: unknown) => Promise.resolve('signed_xdr_placeholder'),
    };
  });
}

/**
 * Run axe on the current page and assert no critical or serious violations.
 * Returns the full results for attachment to the test report.
 */
async function checkA11y(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // Attach full JSON report to Playwright's HTML report for easy remediation
  await test.info().attach('axe-results.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  // Surface a readable summary of violations in the test output
  if (results.violations.length > 0) {
    const summary = results.violations.map((v) =>
      `[${v.impact}] ${v.id}: ${v.description}\n` +
      v.nodes.slice(0, 3).map((n) => `  selector: ${n.target.join(', ')}\n  html: ${n.html}`).join('\n')
    ).join('\n\n');
    expect(results.violations, `Accessibility violations:\n\n${summary}`).toHaveLength(0);
  }
}

// ── Proposal list page ────────────────────────────────────────────────────────

test.describe('Proposal list page', () => {
  test.beforeEach(async ({ page }) => {
    await mockFreighter(page);
    await page.goto('/');
    // Wait for proposal cards to render before scanning
    await page.locator('.proposal-card').first().waitFor({ timeout: 10_000 });
  });

  test('no WCAG AA violations on initial load', async ({ page }) => {
    await checkA11y(page);
  });

  test('no WCAG AA violations after applying a state filter', async ({ page }) => {
    const passedBtn = page.locator('.filter-btn', { hasText: 'Passed' });
    await passedBtn.click();
    await checkA11y(page);
  });

  test('no WCAG AA violations after connecting wallet', async ({ page }) => {
    await page.locator('#wallet-connect-btn').click();
    // Wait for the button label to update before scanning
    await expect(page.locator('#wallet-connect-btn')).not.toHaveText('Connect Wallet', { timeout: 5_000 });
    await checkA11y(page);
  });
});

// ── Dark mode ─────────────────────────────────────────────────────────────────

test.describe('Dark mode', () => {
  test('no WCAG AA violations in dark mode', async ({ page }) => {
    await mockFreighter(page);
    // Enable dark mode before navigation so the theme is set from the start
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });
    await page.goto('/');
    await page.locator('.proposal-card').first().waitFor({ timeout: 10_000 });
    await checkA11y(page);
  });
});
