import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for VoteChain.
 * Targeting local dev server on port 4173.
 *
 * Three browser projects are defined:
 *   chromium  — Chrome/Edge (existing, used by frontend-ci.yml)
 *   firefox   — Firefox stable
 *   webkit    — Safari (via WebKit engine)
 *
 * The cross-browser CI workflow (.github/workflows/cross-browser.yml) runs
 * all three. The existing frontend-ci.yml continues to run chromium only for
 * fast feedback on every push.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
