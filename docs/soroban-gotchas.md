# Soroban Gotchas & Limitations

This page documents Soroban-specific limitations and behaviours that VoteChain developers should be aware of. Many of these differ significantly from EVM-based development.

---

## Storage TTL and Expiry

Soroban uses a **tiered storage model** where every ledger entry has a Time-To-Live (TTL). Entries that are not extended will expire and become inaccessible.

### Storage tiers

| Tier | Scope | TTL behaviour | VoteChain usage |
|------|-------|---------------|-----------------|
| **Instance** | Contract-wide | Shared with the contract instance; extended on every invocation | Admin, VotingToken, ProposalCount, config |
| **Persistent** | Per-key | Independent TTL; must be extended explicitly | Proposals, VoteRecords, HasVoted flags |
| **Temporary** | Per-key | Expires automatically; cannot be restored | Token allowances |

### Key gotchas

- **Persistent entries can expire.** A `Proposal` or `VoteRecord` stored in persistent storage will become unreadable if its TTL is not extended. VoteChain extends TTLs on every write, but long-lived proposals on low-traffic deployments may still require manual TTL bumps.
- **Temporary storage is gone forever once expired.** Token allowances use temporary storage. If an allowance expires before `transfer_from` is called, the transaction will fail with `AllowanceExceeded`.
- **Instance storage is cheap but shared.** All instance keys share one TTL. A single contract call keeps the entire instance alive.

### Extending TTLs manually

```rust
env.storage().persistent().extend_ttl(&key, min_ledgers, max_ledgers);
env.storage().instance().extend_ttl(min_ledgers, max_ledgers);
```

See [docs/storage.md](storage.md) for VoteChain's TTL strategy.

---

## Contract Size Limits

Soroban enforces a hard limit on compiled WASM binary size.

| Limit | Value |
|-------|-------|
| Max contract WASM size | **64 KB** (as of Protocol 22) |

### What this means in practice

- Avoid pulling in large dependencies. Every crate you add increases binary size.
- Use `#![no_std]` (already enforced in VoteChain) — the standard library alone can add tens of KB.
- Run `make build` and check binary sizes before adding new features:

```bash
ls -lh target/wasm32-unknown-unknown/release/*.wasm
```

- The Stellar CLI's `--opt` flag (used in `make build`) runs `wasm-opt` to shrink binaries. Always build with optimisations for deployment.
- If you approach the limit, split functionality into separate contracts and use cross-contract calls.

---

## Cross-Contract Call Costs

Every cross-contract call in Soroban is significantly more expensive than an in-contract function call.

### Cost model

- Each cross-contract invocation consumes **CPU instructions** and **memory bytes** from the transaction budget.
- The governance contract calls the token contract on every `cast_vote` to read the voter's balance. This is intentional (live balance snapshot) but means vote transactions are more expensive than a simple storage write.
- Deeply nested cross-contract calls multiply costs quickly. Avoid call chains longer than 2–3 levels.

### Practical limits

| Resource | Per-transaction budget (approximate) |
|----------|--------------------------------------|
| CPU instructions | ~100 million |
| Memory | ~40 MB |

These budgets are enforced by the Soroban host. Exceeding them causes the transaction to fail with a `ExceededLimit` error — there is no partial execution.

### Tips

- Batch reads where possible. If you need multiple values from another contract, consider whether a single call returning a struct is cheaper than multiple calls.
- Cache cross-contract results in temporary storage within the same transaction if the same value is needed more than once.
- Use `env.budget()` in tests to profile instruction consumption:

```rust
env.budget().reset_default();
// ... call your function ...
println!("{:?}", env.budget());
```

---

## Auth Model Differences from EVM

Soroban's authorisation model is fundamentally different from Ethereum's `msg.sender` pattern.

### No `msg.sender`

In EVM contracts, `msg.sender` is implicitly available and identifies the caller. In Soroban, **there is no implicit caller identity**. Every function that requires authorisation must explicitly call `address.require_auth()`.

```rust
// EVM pattern — NOT available in Soroban
require(msg.sender == admin, "not admin");

// Soroban pattern
admin.require_auth();  // panics if the transaction was not signed by admin
```

### `require_auth()` must be called on the correct address

- `require_auth()` checks that the transaction (or a sub-invocation authorisation envelope) was signed by that specific address.
- Forgetting `require_auth()` on a privileged function means **anyone can call it**. VoteChain calls `require_auth()` on every state-changing function.
- Unlike EVM, the authorisation check is enforced by the host — it cannot be spoofed by a malicious caller contract.

### Sub-invocation authorisation

When contract A calls contract B, contract B can call `address.require_auth()` for an address that is not the invoking contract. The Stellar transaction must include a signed authorisation envelope for that address covering the specific sub-invocation. This is how VoteChain's governance contract is authorised to read balances from the token contract on behalf of a voter.

### Account vs contract addresses

- Stellar accounts (G... addresses) use ed25519 key pairs.
- Contract addresses (C... addresses) authorise via their own contract logic.
- Both implement the same `require_auth()` interface, but the underlying verification differs.

### No `tx.origin`

There is no equivalent of EVM's `tx.origin`. Do not attempt to use the invoking contract's address as a proxy for the original signer — use explicit `require_auth()` instead.

---

## WASM Determinism Requirements

Soroban contracts execute inside a deterministic WASM host. All validators must produce identical results for the same inputs.

### What is forbidden

| Feature | Reason |
|---------|--------|
| Floating-point arithmetic | Results can differ across CPU architectures |
| System time / randomness | Non-deterministic by definition |
| I/O (files, network, stdin) | Not available in `no_std` WASM |
| Threads / async | Not supported in the Soroban WASM environment |
| `std::collections::HashMap` (unordered) | Iteration order is non-deterministic |

### VoteChain conventions

- All numeric values use `i128` — no `f32` or `f64` anywhere in the contracts.
- Time is read from `env.ledger().timestamp()`, which is the ledger close time agreed by consensus — not the system clock.
- Randomness is not used. If you need a pseudo-random value, derive it from ledger data (sequence number, timestamp) and document the limitations.
- Use `soroban_sdk::Map` and `soroban_sdk::Vec` instead of `std::collections` types. These are deterministically ordered.

### WASM-specific Rust restrictions

- `#![no_std]` is required. Any crate that pulls in `std` will fail to compile for `wasm32-unknown-unknown`.
- Panic messages are stripped in optimised builds. Use `ContractError` variants to communicate failure reasons rather than relying on panic strings.
- Stack size is limited. Avoid deep recursion; prefer iterative algorithms.

---

## Next Steps

- [Storage Model](storage.md) — detailed TTL strategy and storage tier decisions
- [Architecture Decision Records](adr/) — rationale behind VoteChain's design choices
- [FAQ](faq.md) — common questions from developers new to Soroban
- [Stellar Soroban Docs](https://developers.stellar.org/docs/learn/soroban) — official platform documentation
