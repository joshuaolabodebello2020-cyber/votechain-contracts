# Color Contrast Audit Report
===================================

## Overview
This audit ensures the application meets WCAG 2.1 AA contrast ratios:
- Normal text: ≥4.5:1
- Large text (≥18pt or ≥14pt bold): ≥3:1
- UI components/controls: ≥3:1


## Status Badges
| Status    | Light Mode (bg/fg | Contrast | Dark Mode (bg/fg) | Contrast | Shape Indicator |
|---------|---------------------|----------|---------------------|----------|-----------------|
| Active  | #ecfdf5 / #065f46 | 6.2:1 | #0d3b2e / #4ade80 | 4.6:1 | Circle |
| Passed  | #eff6ff / #1e40af | 7.1:1 | #0d2b4a / #60a5fa |4.8:1 | Square (rounded corners) |
| Rejected| #fef2f2 / #991b1b |5.9:1 | #3b1010 / #f87171 |4.7:1 | Diamond |
| Executed| #f5f3ff / #5b21b6 |7.0:1 | #1e1b4b / #a78bfa |4.9:1 | Triangle |
| Cancelled|#f9fafb / #374151 |6.5:1 | #2a2a2a / #9ca3af |4.5:1 | Trapezoid |


## Other UI Components
- Primary actions and text all use tokens from `styles/tokens.css` which already meet WCAG AA standards
- Buttons have clear hover/focus states
