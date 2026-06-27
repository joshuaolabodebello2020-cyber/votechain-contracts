# Accessibility Testing

VoteChain runs automated WCAG 2.1 AA accessibility scans on every CI run using [axe-core](https://github.com/dequelabs/axe-core) via the [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) integration.

---

## How to run locally

```bash
cd frontend

# Run only accessibility tests
npm run test:a11y

# View the HTML report with axe violation details
npx playwright show-report
```

The HTML report includes a full `axe-results.json` attachment for each test — open the report, click a test, and expand the attachment to see every violation, its impact level, and the exact HTML elements affected.

---

## What is scanned

| Test | Page/state |
|------|-----------|
| Initial page load | `GET /` — proposal list with cards rendered |
| After state filter | After clicking the **Passed** filter button |
| After wallet connect | After the wallet connect button is clicked |
| Dark mode | Page loaded with `theme=dark` in localStorage |

Rules applied: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`

---

## CI integration

The `accessibility` job runs in `frontend-ci.yml` on every push and PR that touches `frontend/`. It is a **blocking** job — CI fails if any critical or serious WCAG violation is introduced.

The Playwright HTML report is uploaded as the `a11y-report-<run_id>` artifact (14-day retention) on every run, including failures, so violations can be diagnosed without re-running locally.

---

## Violation severity levels

axe-core assigns one of four impact levels. The test suite fails on **any** violation regardless of level (axe does not report below `minor`):

| Impact | Examples |
|--------|---------|
| `critical` | Images without alt text, form inputs without labels |
| `serious` | Insufficient color contrast, missing ARIA roles |
| `moderate` | Redundant ARIA roles, empty headings |
| `minor` | Layout tables, redundant title attributes |

---

## Diagnosing failures

1. Open the `a11y-report-<run_id>` artifact from the Actions run.
2. Click the failing test — the `axe-results.json` attachment lists every violation with:
   - `id` — axe rule ID (e.g. `color-contrast`, `label`)
   - `impact` — severity level
   - `description` — human-readable explanation
   - `nodes[].target` — CSS selector of the affected element
   - `nodes[].html` — the actual HTML snippet
3. Use the [axe rule reference](https://dequeuniversity.com/rules/axe/) for remediation guidance.

**Quick local reproduction:**

```bash
cd frontend
npm run test:a11y 2>&1 | grep -A 10 "selector:"
```

---

## Known limitations

### Freighter wallet extension

The Freighter browser extension is not available in automated environments. All tests inject `window.freighter` via `page.addInitScript()` so wallet-gated UI renders fully. The mock is identical to `proposals.spec.ts`.

### Dynamic content

axe scans the DOM at a single point in time. Content that is conditionally rendered only after user interaction (e.g. modal dialogs, vote confirmation toasts) is not scanned in the current suite. Add new `test` blocks to `e2e/a11y.spec.ts` to cover additional states as they are built.

### WebKit / Firefox

The accessibility tests run on Chromium only (matching the existing `frontend-ci.yml` E2E setup). The axe-core DOM-based analysis is browser-independent for WCAG structural checks; browser-specific rendering differences for visual checks (e.g. contrast) are not significant between engines for the current component set.
