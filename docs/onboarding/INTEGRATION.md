# Onboarding Tutorial — Integration Guide

This document explains how a frontend should consume the onboarding content in this directory to satisfy [issue #455](https://github.com/Vera3289/votechain-contracts/issues/455).

---

## File overview

| File | Purpose |
|---|---|
| `tutorial-steps.json` | Ordered tutorial steps shown to first-time users |
| `glossary.json` | Contextual help terms rendered as tooltips or a help panel |
| `i18n/en.json` | English strings (baseline) |
| `i18n/es.json` | Spanish strings (example translation) |

---

## Tutorial flow

1. On first load, check `localStorage.getItem('vc_tutorial_dismissed')`.
2. If `null`, render the tutorial modal using `tutorial-steps.json`.
3. Advance through steps with the `cta` button. Show `common.step` ("Step 1 of 6") for progress.
4. On the final step (or an explicit dismiss action), set `localStorage.setItem('vc_tutorial_dismissed', '1')` and close the modal.
5. Expose a "Help" / "?" button that clears the flag and re-opens the tutorial to satisfy the *revisit* requirement.

```
first visit
    │
    ▼
vc_tutorial_dismissed === null?
    │ yes                   │ no
    ▼                       ▼
show modal             show nothing
    │
user clicks Done / Dismiss
    │
    ▼
set vc_tutorial_dismissed = '1'
```

---

## Glossary / contextual help

Render each `glossary.json` term as a tooltip on the matching UI element, or collect them in a slide-out help panel.

```js
// minimal tooltip example
import glossary from './docs/onboarding/glossary.json';

function helpText(termId) {
  return glossary.terms.find(t => t.id === termId)?.definition ?? '';
}
```

---

## Internationalisation

Load the correct locale file at startup. Fall back to `en` for any missing key.

```js
const locale = navigator.language.startsWith('es') ? 'es' : 'en';
const strings = await import(`./docs/onboarding/i18n/${locale}.json`);

// usage
strings.onboarding['create-proposal'].title  // "Create a proposal"
strings.glossary['quorum']                   // "The minimum total votes…"
strings.common.dismiss                       // "Dismiss"
```

Add new locales by copying `i18n/en.json`, translating the values, and naming the file with the BCP-47 language tag (e.g. `fr.json`, `pt-BR.json`).

---

## Accessibility checklist

- Modal must trap focus and be dismissible with `Escape`.
- All interactive elements need `aria-label` or visible text.
- Use `role="dialog"` and `aria-modal="true"` on the modal container.
- Colour contrast must meet WCAG 2.1 AA (≥ 4.5 : 1 for normal text).
- Tutorial progress ("Step 2 of 6") should be announced via `aria-live="polite"`.
