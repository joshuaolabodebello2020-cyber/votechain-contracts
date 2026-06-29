# CI Pipeline

This document describes the CI pipeline stages, what they check, and which checks block merges.

## Pipeline Overview

The CI runs on every push to `main`/`develop` and on every pull request targeting those branches.

### Rust / Contracts

| Job                 | Trigger        | What it checks                          |
|---------------------|----------------|-----------------------------------------|
| `test`              | push + PR      | `cargo fmt`, `cargo clippy`, `cargo test` |
| `coverage`          | after `test`   | Line coverage ≥ 80% per contract package |
| `build-wasm`        | after `test`   | WASM binary build + size limits          |
| `wasm-validity`     | after WASM     | WASM validity tests via `scripts/test_wasm.sh` |
| `security-audit`    | after `test`   | `cargo audit` for known vulnerabilities  |

### Backend (TypeScript)

| Job                 | Trigger                  | What it checks                   |
|---------------------|--------------------------|----------------------------------|
| `backend`           | push + PR                | `npm run lint`, `tsc`, `vitest`  |
| `backend-coverage`  | push + PR                | Coverage ≥ 60% (lines, branches, functions, statements) |

CI commands:
```bash
cd backend
npm ci
npm run lint          # ESLint
npm run build         # TypeScript compilation
npm run test          # vitest run
npm run test:coverage # vitest run --coverage
```

### Frontend

| Job                   | Trigger                      | What it checks                   |
|-----------------------|------------------------------|----------------------------------|
| `Frontend CI / build` | push/PR changing `frontend/` | lint, typecheck, unit tests, build, bundle size, E2E |
| `frontend-coverage`   | push + PR                    | Coverage ≥ 60%                   |
| `accessibility`       | push/PR changing `frontend/` | axe WCAG AA audit                |

CI commands:
```bash
cd frontend
npm ci
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run test          # vitest run
npm run build         # tsc && vite build
npm run size          # bundle size tracking
npm run test:e2e      # Playwright E2E
```

### Other Checks

| Job                  | Purpose                                 |
|----------------------|-----------------------------------------|
| `license-check`      | Apache 2.0 header on all `.rs` files    |
| `secret-scan`        | Gitleaks for leaked secrets             |
| `openapi-validate`   | Redocly lint on `api/openapi.yml`       |
| `CodeQL`             | GitHub code scanning                    |

## Merge Gate

The merge gate (`.github/workflows/merge-gate.yml`) enforces that the following checks pass before a PR can merge:

- `CI / test` (Rust build and test)
- `CI / build-wasm` (WASM compilation and size)
- `CI / Backend TypeScript Build & Lint` (backend lint + build + tests)
- `CI / Backend Coverage` (backend test coverage)
- `Frontend CI / build` (frontend lint + typecheck + tests + build)
- `CodeQL` (security scanning)

PR titles must follow Conventional Commits format: `type(scope): description`.

## Adding a New CI Stage

1. Add the job to the relevant workflow file in `.github/workflows/`.
2. If the check should block merges, add its name to the `requiredChecks` array in `merge-gate.yml`.
3. Document the new stage in this file.
