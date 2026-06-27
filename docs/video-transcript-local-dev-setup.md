# Transcript: VoteChain Local Development Setup Walkthrough

> Video: [Watch on YouTube](https://www.youtube.com/watch?v=TODO_REPLACE_WITH_REAL_ID)  
> Duration: ~8 minutes

---

## [0:00] Introduction

Hi, welcome to VoteChain. In this walkthrough I'll show you how to clone the repository, install the required tools, run the test suite, and build the WASM contract binaries — everything you need to start contributing locally.

---

## [0:30] Prerequisites

Before we start, you'll need:

- A Unix-like terminal (Linux, macOS, or WSL on Windows)
- Git installed
- An internet connection to download Rust and dependencies

---

## [1:00] Step 1 — Clone the repository

```bash
git clone https://github.com/Vera3289/votechain-contracts.git
cd votechain-contracts
```

You'll see two contracts under `contracts/`: `governance` and `token`.

---

## [1:45] Step 2 — Install Rust with rustup

If you don't have Rust installed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Follow the prompts and choose the default installation. Restart your terminal, then verify:

```bash
rustc --version
cargo --version
```

---

## [2:30] Step 3 — Add the WebAssembly target

Soroban contracts compile to WebAssembly, so we need the `wasm32` target:

```bash
rustup target add wasm32-unknown-unknown
```

---

## [3:00] Step 4 — Install the Stellar CLI

```bash
cargo install --locked stellar-cli@21.6.0 --features opt
```

This takes a few minutes. Verify afterwards:

```bash
stellar --version
```

You should see `21.6.0`.

---

## [4:00] Step 5 — Run the test suite

```bash
make test
```

This runs all unit and property-based tests for both contracts. You should see output ending with something like:

```
test result: ok. 65 passed; 0 failed
```

---

## [5:30] Step 6 — Build the WASM binaries

```bash
make build
```

This compiles both contracts to optimised `.wasm` files under `target/wasm32-unknown-unknown/release/`.

---

## [6:30] Step 7 — Optional: run linting and formatting

```bash
make lint    # Clippy — fails on any warning
make fmt     # Auto-format with rustfmt
```

These are required to pass CI before opening a pull request.

---

## [7:15] Next steps

- Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the pull request workflow.
- Browse [open issues](https://github.com/Vera3289/votechain-contracts/issues) to find something to work on.
- Deploy to testnet by following the [Testnet Deployment guide](testnet-deployment.md).

---

## [7:50] Closing

That's it — you're ready to contribute to VoteChain. Thanks for watching!
