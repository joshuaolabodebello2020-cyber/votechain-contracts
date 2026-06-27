# Browser Compatibility

VoteChain targets the latest stable versions of Chrome, Firefox, and Safari. Cross-browser E2E tests run automatically in CI using Playwright.

---

## Supported browsers

| Browser | Engine | Minimum version | Playwright project |
|---------|--------|----------------|-------------------|
| Chrome / Edge | Chromium | Latest stable | `chromium` |
| Firefox | Gecko | Latest stable | `firefox` |
| Safari | WebKit | Latest stable | `webkit` |

---

## Running cross-browser tests locally

```bash
cd frontend

# All three browsers
npx playwright test

# Single browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# View HTML report after a run
npx playwright show-report
```

---

## CI integration

- **`frontend-ci.yml`** — runs Chromium only on every push/PR for fast feedback.
- **`cross-browser.yml`** — runs all three browsers on every PR touching `frontend/`, weekly (Mon 04:00 UTC), and on demand.

Each browser job uploads a Playwright HTML report and (on failure) screenshots as GitHub Actions artifacts (14-day retention).

`fail-fast: false` ensures all three browsers run independently so failures are visible per-browser rather than stopping on the first.

---

## Known compatibility limitations

### Freighter wallet extension

The Freighter wallet browser extension is not available in automated test environments. All tests inject a `window.freighter` mock via `page.addInitScript()`. This matches the mock used in `proposals.spec.ts` and behaves identically across all browsers.

**Limitation**: Tests cannot verify actual extension installation or browser-native extension UI flows.

### WebKit / Safari

- `CSS.supports()` coverage for newer CSS features may differ slightly from Chromium/Firefox. The app uses standard CSS custom properties and flexbox/grid which are fully supported.
- WebKit on Linux (used by Playwright's `webkit` engine) does not have access to macOS-specific rendering; visual output will differ slightly from Safari on macOS. Structural and functional assertions are unaffected.
- `window.matchMedia` is available in WebKit via Playwright; dark-mode simulation works correctly.

### Firefox

- `scrollbar-width` styling differs from Chromium. No functional tests depend on scrollbar appearance.
- `font-display` fallback timing may differ. Layout tests assert element visibility, not pixel metrics.

### Content Security Policy

The dev server sets a strict CSP (see `vite.config.ts`). All three browsers enforce it. `connect-src` is limited to `self` and the Stellar RPC endpoints — no external fonts or scripts are loaded, which avoids CSP-related cross-browser differences.

### Animations and transitions

CSS transitions are present (`duration-normal` token). Playwright's `toBeVisible()` waits for elements to be present in the DOM but does not wait for CSS transitions to complete. If a test asserts state immediately after triggering an animation, it may see an intermediate visual state. The tests in `cross-browser.spec.ts` avoid assertions that depend on animation completion.

---

## Adding new cross-browser tests

Add test cases to `frontend/e2e/cross-browser.spec.ts`. Follow these guidelines for stability:

1. **Use stable selectors** — prefer `#id`, `.class`, and `role` over text content where possible.
2. **Avoid timing assumptions** — use `await expect(locator).toBeVisible()` rather than fixed `page.waitForTimeout()`.
3. **Do not assert pixel values** — assert structural presence, not computed dimensions.
4. **Conditional assertions** — if a UI element only exists in certain states (e.g. no Passed proposals), guard with `if (await locator.count() === 0) return`.
5. **Viewport tests** — use `page.setViewportSize()` rather than device emulation for responsive checks, so they run identically across all three browsers.
