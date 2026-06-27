# Issue Triage and Label Guide

This guide establishes a consistent taxonomy for VoteChain issue labels and defines the process triage owners follow when processing new issues.

---

## Table of Contents

- [Labels Overview](#labels-overview)
- [Type Labels](#type-labels)
- [Priority Labels](#priority-labels)
- [Severity Labels](#severity-labels)
- [Area Labels](#area-labels)
- [Status Labels](#status-labels)
- [Triage Process](#triage-process)
- [Triage Owners](#triage-owners)
- [Escalation Paths](#escalation-paths)

---

## Labels Overview

Every issue should carry **at least one** label from each of the following groups: **Type**, **Priority**, and **Area**. Severity labels are applied only to bugs. Status labels track where an issue sits in the workflow.

---

## Type Labels

| Label | Color | Description |
|---|---|---|
| `type: bug` | `#d73a4a` (red) | Something is broken or behaves contrary to spec. |
| `type: feature` | `#0075ca` (blue) | A new capability or user-visible behaviour. |
| `type: enhancement` | `#cfd3d7` (grey) | An improvement to an existing feature. |
| `type: chore` | `#e4e669` (yellow) | Dependency bumps, CI plumbing, non-user-visible housekeeping. |
| `type: docs` | `#0052cc` (navy) | Documentation additions or corrections. |
| `type: test` | `#bfd4f2` (light blue) | Test additions, coverage improvements, test infrastructure. |
| `type: security` | `#b60205` (dark red) | Security-related findings or hardening work. |
| `type: performance` | `#fbca04` (amber) | Latency, throughput, or resource-usage improvements. |

---

## Priority Labels

Priority reflects urgency from the project's delivery standpoint.

| Label | Color | Description | Expected response |
|---|---|---|---|
| `priority: critical` | `#b60205` (dark red) | Blocks a release or causes data loss/corruption. | Immediate — same business day. |
| `priority: high` | `#e11d48` (rose) | Significantly degrades UX or blocks integration work. | Next sprint. |
| `priority: medium` | `#f97316` (orange) | Important but non-blocking; work can be scheduled. | Within two sprints. |
| `priority: low` | `#84cc16` (green) | Nice to have; address when capacity allows. | Backlog. |

### How to pick a priority

1. **Critical** — production system unreachable, funds at risk, or release gate blocked.
2. **High** — primary user flows broken (voting, proposal creation, wallet connection) or CI consistently failing.
3. **Medium** — degraded experience in secondary flows, or a feature gap that has a reasonable workaround.
4. **Low** — polish, minor UX improvements, or purely additive documentation.

---

## Severity Labels

Severity applies only to `type: bug` issues and describes the blast radius, independent of how quickly it must be fixed.

| Label | Color | Description |
|---|---|---|
| `severity: critical` | `#b60205` (dark red) | Data corruption, funds at risk, or complete feature loss. |
| `severity: major` | `#e11d48` (rose) | Core feature broken; no acceptable workaround exists. |
| `severity: minor` | `#f97316` (orange) | Feature partially broken; a workaround exists. |
| `severity: trivial` | `#84cc16` (green) | Cosmetic issue; no functional impact. |

**Priority vs Severity:** A bug can have `severity: major` (big blast radius) but `priority: medium` if it affects a rarely-used path. Conversely, a `severity: minor` bug might be `priority: high` if it is in a critical user-facing flow.

---

## Area Labels

Area labels identify which part of the system the issue belongs to.

| Label | Color | Description |
|---|---|---|
| `area: contracts` | `#5319e7` (purple) | Soroban smart contracts (governance, token). |
| `area: backend` | `#0075ca` (blue) | Express API, Redis caching, rate limiting, indexer. |
| `area: frontend` | `#006b75` (teal) | React UI, wallet integration, i18n, accessibility. |
| `area: sdk` | `#d93f0b` (burnt orange) | TypeScript SDK for contract interaction. |
| `area: ci-cd` | `#cfd3d7` (grey) | GitHub Actions workflows, build scripts, Dockerfiles. |
| `area: docs` | `#0052cc` (navy) | Guides, references, ADRs, changelogs. |
| `area: security` | `#b60205` (dark red) | Cross-cutting security concerns. |

---

## Status Labels

Status labels reflect where an issue currently sits in the workflow. These are managed by assignees and triage owners.

| Label | Color | Description |
|---|---|---|
| `status: needs-triage` | `#e4e669` (yellow) | Newly filed; has not yet been reviewed by a triage owner. |
| `status: needs-info` | `#cfd3d7` (grey) | Waiting on the reporter for reproduction steps or clarification. |
| `status: confirmed` | `#0075ca` (blue) | Reproduced or accepted; ready to be assigned and scheduled. |
| `status: in-progress` | `#f97316` (orange) | Actively being worked on. |
| `status: blocked` | `#b60205` (dark red) | Work cannot proceed without an external decision or dependency. |
| `status: wont-fix` | `#cfd3d7` (grey) | Intentionally not addressed; reason must be stated in the issue. |
| `status: duplicate` | `#cfd3d7` (grey) | Duplicate of another issue (link the original). |

---

## Triage Process

### Step 1 — Initial screening (within 24 h of filing)

A triage owner reviews each new issue and:

1. Confirms the issue is intelligible and reproducible (or requests info via `status: needs-info`).
2. Removes `status: needs-triage` and applies `status: confirmed` (or `status: needs-info` / `status: wont-fix`).
3. Assigns **one** type label, **one** priority label, and **one or more** area labels.
4. Assigns a severity label if the issue is a `type: bug`.

### Step 2 — Scheduling

After confirming an issue:

- **Critical / High** issues are pulled into the current sprint immediately.
- **Medium** issues are placed in the upcoming sprint during the next sprint-planning session.
- **Low** issues land in the backlog for future prioritisation.

### Step 3 — Ongoing updates

The assignee keeps the status label current:

- Set `status: in-progress` when work begins.
- Set `status: blocked` with a comment explaining the blocker if work stalls.
- Close the issue (and remove in-progress labels) when the fix is merged and verified.

---

## Triage Owners

Each area has a designated triage owner responsible for initial screening:

| Area | Owner |
|---|---|
| `area: contracts` | Contract team lead |
| `area: backend` | Backend team lead |
| `area: frontend` | Frontend team lead |
| `area: sdk` | SDK maintainer |
| `area: ci-cd` | DevOps lead |
| `area: docs` | Any team member (rotate) |
| `area: security` | Security lead — **bypass normal triage; escalate immediately** |

When the designated owner is unavailable, any other team lead may perform triage to avoid the 24-hour SLA lapsing.

---

## Escalation Paths

| Situation | Action |
|---|---|
| `type: security` issue filed publicly | Immediately ask the reporter to use the private security disclosure channel (see [SECURITY.md](../SECURITY.md)) and close the public issue. |
| `priority: critical` issue confirmed | Notify the project lead and relevant team lead in Slack `#votechain-incidents`. Begin work within 2 hours. |
| Issue stale for > 14 days with no update | Triage owner pings assignee; if no response within 48 h, reassign or de-prioritise. |
| `status: needs-info` for > 7 days with no response | Close the issue with a comment that it can be reopened when information is available. |
