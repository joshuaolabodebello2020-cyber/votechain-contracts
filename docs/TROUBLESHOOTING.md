# Troubleshooting Guide

Common issues encountered during local development and how to resolve them.

---

## Rust & Contract Development

### WASM target not installed

**Symptom:**
```
error[E0463]: can't find crate for 'std'
```

**Cause:** The `wasm32-unknown-unknown` compilation target is missing.

**Fix:**
```bash
rustup target add wasm32-unknown-unknown
```

---

### Stellar CLI version mismatch

**Symptom:** Build or deploy scripts fail with unexpected errors, or `stellar --version` does not print `21.6.0`.

**Cause:** The project requires an exact CLI version. Other versions may introduce breaking changes.

**Fix:**
```bash
cargo install --locked stellar-cli@21.6.0 --features opt
stellar --version   # should print 21.6.0
```

You can also verify with `make check-stellar-cli`.

---

### `cargo test` fails with linker errors

**Symptom:**
```
error: linking with `cc` failed
```

**Cause:** Missing system libraries (common on fresh Linux installs).

**Fix:**
```bash
# Debian / Ubuntu
sudo apt-get install -y pkg-config libssl-dev build-essential

# macOS (Xcode command-line tools)
xcode-select --install
```

---

### Clippy warnings block CI

**Symptom:** CI fails on `cargo clippy` even though `cargo test` passes locally.

**Cause:** The project enforces zero warnings: `cargo clippy --all-targets -- -D warnings`.

**Fix:** Run clippy locally before pushing:
```bash
make lint
```

Fix all warnings, then commit.

---

### WASM binary too large

**Symptom:** CI fails the binary-size enforcement step.

**Cause:** The governance contract must be ≤ 100 KB and the token contract ≤ 50 KB.

**Fix:**
- Check you're building in release mode (`stellar contract build` does this by default).
- Remove unnecessary dependencies from `Cargo.toml`.
- Run `make build` and check sizes: `ls -lh target/wasm32-unknown-unknown/release/*.wasm`.

---

## Docker

### `Cannot connect to the Docker daemon`

**Symptom:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Cause:** Docker is not running.

**Fix:**
```bash
# Linux
sudo systemctl start docker

# macOS / Windows
# Start Docker Desktop from your applications
```

---

### Container build fails with network errors

**Symptom:** `docker compose build` fails downloading packages.

**Cause:** Network proxy or DNS issues inside the Docker daemon.

**Fix:**
- Check your internet connection.
- If behind a corporate proxy, configure Docker's proxy settings in `~/.docker/config.json`.
- Try `docker system prune` to clear stale state, then rebuild.

---

### Redis connection refused

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause:** The Redis container isn't running, or the backend is trying to connect to localhost instead of the Docker service name.

**Fix:**
- If using Docker Compose: `docker compose up redis` and ensure `REDIS_URL=redis://redis:6379` is set.
- If running the backend outside Docker: start a local Redis (`redis-server`) or point `REDIS_URL` to a running instance.

---

### Port already in use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Cause:** Another process is using the port.

**Fix:**
```bash
# Find the process
lsof -i :3001

# Kill it
kill <PID>
```

Default ports: `8000` (Stellar RPC), `3001` (backend), `4173` (frontend dev server).

---

## Node.js / Frontend

### `npm install` fails with peer dependency conflicts

**Symptom:**
```
npm ERR! ERESOLVE could not resolve
```

**Cause:** Conflicting peer dependency versions.

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
```

If that doesn't work, check that you are using Node.js 18+:
```bash
node --version
```

---

### Vite dev server won't start

**Symptom:** `npm run dev` exits immediately or the page won't load.

**Cause:** Missing dependencies or port conflict.

**Fix:**
1. Ensure dependencies are installed: `cd frontend && npm install`
2. Check for port conflicts on `4173`.
3. Check the console for specific error messages.

---

### Tests fail with `Cannot find module`

**Symptom:**
```
Error: Cannot find module '../utils/validation'
```

**Cause:** Dependencies not installed, or the file was renamed/moved.

**Fix:**
```bash
cd frontend && npm install
npm test
```

---

### `vitest` not found

**Symptom:**
```
sh: vitest: not found
```

**Cause:** Dev dependencies not installed.

**Fix:**
```bash
npm install
npx vitest run    # or: npm test
```

---

## Backend

### OpenAPI validation errors on startup

**Symptom:**
```
Error: ENOENT: no such file or directory, open '.../api/openapi.yml'
```

**Cause:** The backend resolves `openapi.yml` relative to `__dirname`. If you run the compiled JS from a different directory, the path breaks.

**Fix:** Run the backend from the `backend/` directory:
```bash
cd backend
npm run dev
```

---

### `ADMIN_API_KEY` not set

**Symptom:** Admin endpoints return `500 SERVER_MISCONFIGURED`.

**Cause:** The `ADMIN_API_KEY` environment variable is not set.

**Fix:** Add it to your `.env` or export it:
```bash
export ADMIN_API_KEY=your-secret-key
```

Admin-protected endpoints: `POST /proposals/invalidate`, `GET /metrics/cache`.

---

### Rate limiter blocks requests during development

**Symptom:** Requests return `429 Too Many Requests` during local testing.

**Cause:** The rate limiter is active by default.

**Fix:** This is expected behavior. Wait for the rate limit window to reset, or increase the limit in development by setting the appropriate environment variable.

---

## Git

### `fatal: Unable to create '.git/index.lock'`

**Symptom:** Git operations fail with a lock file error.

**Cause:** A previous Git operation was interrupted.

**Fix:**
```bash
rm .git/index.lock
```

---

### Pre-commit hook fails

**Symptom:** `git commit` is rejected by a pre-commit hook.

**Cause:** Formatting or lint checks failed.

**Fix:**
```bash
make fmt     # auto-format
make lint    # check for warnings
make test    # run tests
```

Then stage changes and commit again.

---

## Environment Setup Checklist

If you're starting from scratch and something isn't working, verify each step:

```bash
# 1. Rust toolchain
rustc --version                                    # 1.75+
rustup target list | grep wasm32-unknown-unknown   # should show "installed"

# 2. Stellar CLI
stellar --version                                  # 21.6.0

# 3. Node.js
node --version                                     # 18+

# 4. Docker (optional)
docker --version
docker compose version

# 5. Dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 6. Build & test
make build
make test
```

If a step fails, check the relevant section above.
