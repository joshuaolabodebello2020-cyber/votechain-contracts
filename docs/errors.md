# Contract Error Reference

All `ContractError` codes returned by VoteChain smart contracts as `u32` values.

Error codes are **scoped per contract** — code `1` in the governance contract and code `1` in the token contract are independent. Errors surface as `Result::Err(ContractError)` and appear as a `u32` in Soroban host diagnostics.

---

## Table of Contents

- [Governance Contract Errors](#governance-contract-errors)
- [Token Contract Errors](#token-contract-errors)
- [Pre-flight Checks](#pre-flight-checks)

---

## Governance Contract Errors

### <a id="gov-1"></a>`1` — `AdminNotSet`

**Description:** Contract has not been initialized — no admin address is stored.  
**Common cause:** Calling any function before `initialize` has been invoked.  
**Resolution:** Call `initialize(admin, voting_token, ...)` once before invoking any other function.

---

### <a id="gov-2"></a>`2` — `NotAdmin`

**Description:** Caller is not the configured admin address.  
**Common cause:** Signing the transaction with a non-admin keypair, or calling an admin-only function (e.g. `execute`, `cancel`, `pause`) from the wrong account.  
**Resolution:** Sign the transaction with the admin keypair set during `initialize`. Use `get_admin()` to confirm the current admin address.

---

### <a id="gov-3"></a>`3` — `VotingTokenNotSet`

**Description:** The governance token address was not set during initialization.  
**Common cause:** Passing an invalid or zero address for `voting_token` during `initialize`.  
**Resolution:** Re-deploy and initialize the contract with a valid SEP-41-compatible `voting_token` address.

---

### <a id="gov-4"></a>`4` — `InvalidQuorum`

**Description:** `quorum` passed to `create_proposal` or `update_quorum` is zero or negative.  
**Common cause:** Passing `0` or a negative value as the quorum threshold.  
**Resolution:** Provide a quorum value greater than zero, denominated in token units (e.g. `1_000_000` for 1M tokens).

---

### <a id="gov-5"></a>`5` — `InvalidDuration`

**Description:** `duration` passed to `create_proposal` is zero.  
**Common cause:** Passing `0` as the voting duration.  
**Resolution:** Provide a duration of at least 1 second. See also [`InvalidDurationRange`](#gov-21) for range enforcement.

---

### <a id="gov-6"></a>`6` — `ProposalNotFound`

**Description:** No proposal exists for the given `proposal_id`.  
**Common cause:** Using an ID that was never created, or an off-by-one error (IDs start at `1`).  
**Resolution:** Verify the ID with `proposal_count()` — valid IDs are in the range `[1, proposal_count()]`.

---

### <a id="gov-7"></a>`7` — `ProposalNotActive`

**Description:** The proposal is not in `Active` status (e.g. already `Passed`, `Rejected`, `Executed`, or `Cancelled`).  
**Common cause:** Calling `cast_vote`, `cancel`, or `update_quorum` on a proposal that has already been finalized or cancelled.  
**Resolution:** Check the proposal status with `get_proposal(proposal_id).state` before calling the function.

---

### <a id="gov-8"></a>`8` — `VotingPeriodEnded`

**Description:** The current ledger timestamp is past the proposal's `end_time`.  
**Common cause:** Attempting to cast a vote after the voting window has closed.  
**Resolution:** The voting window has closed. Call `finalise(proposal_id)` to settle the result.

---

### <a id="gov-9"></a>`9` — `VotingStillOpen`

**Description:** `finalise` was called before the voting period has ended.  
**Common cause:** Calling `finalise` too early, before `ledger_timestamp > end_time`.  
**Resolution:** Wait until the ledger timestamp exceeds the proposal's `end_time`, then retry.

---

### <a id="gov-10"></a>`10` — `AlreadyVoted`

**Description:** The voter address has already cast a vote on this proposal.  
**Common cause:** Calling `cast_vote` twice from the same address on the same proposal.  
**Resolution:** Each address may vote exactly once. Use `has_voted(proposal_id, voter)` to check before calling `cast_vote`.

---

### <a id="gov-11"></a>`11` — `NoVotingPower`

**Description:** The voter holds zero governance tokens at the time of voting.  
**Common cause:** Voting from an address with no token balance, or voting before receiving tokens.  
**Resolution:** Acquire a non-zero balance of the governance token before casting a vote. Check balance with the token contract's `balance(voter)`.

---

### <a id="gov-12"></a>`12` — `ProposalNotPassed`

**Description:** `execute` was called on a proposal that did not reach `Passed` status.  
**Common cause:** Calling `execute` on a `Rejected`, `Active`, or `Cancelled` proposal.  
**Resolution:** Confirm the proposal status is `Passed` with `get_proposal(proposal_id).state` before calling `execute`.

---

### <a id="gov-13"></a>`13` — `AlreadyInitialized`

**Description:** Contract has already been initialized.  
**Common cause:** Calling `initialize` more than once on the same deployed contract.  
**Resolution:** `initialize` is a one-time operation. Deploy a new contract instance if a fresh initialization is required.

---

### <a id="gov-14"></a>`14` — `VoteTallyOverflow`

**Description:** Vote tally arithmetic overflowed `i128::MAX`.  
**Common cause:** Extremely large token balances causing the cumulative vote total to exceed `i128::MAX` (~170 × 10²⁴).  
**Resolution:** This is a contract invariant violation. Ensure total token supply stays well within `i128::MAX`. Contact the maintainers if this error is encountered in production.

---

### <a id="gov-15"></a>`15` — `InsufficientBalance`

**Description:** Proposer has insufficient token balance to create a proposal.  
**Common cause:** The proposer's balance is below the `min_proposal_balance` threshold set at initialization.  
**Resolution:** Acquire enough governance tokens to meet the minimum balance requirement. Check the threshold via contract configuration.

---

### <a id="gov-16"></a>`16` — `ProposalCooldown`

**Description:** Proposer must wait for the cooldown period to expire before creating another proposal.  
**Common cause:** Creating a second proposal before the `proposal_cooldown` seconds have elapsed since the last one.  
**Resolution:** Wait for the cooldown period to expire. The cooldown duration is set at initialization via `proposal_cooldown`.

---

### <a id="gov-17"></a>`17` — `TitleTooLong`

**Description:** Proposal title exceeds the maximum byte length.  
**Common cause:** Passing a title string longer than 128 bytes.  
**Resolution:** Shorten the title to 128 bytes or fewer.

---

### <a id="gov-18"></a>`18` — `DescriptionTooLong`

**Description:** Proposal description exceeds the maximum byte length.  
**Common cause:** Passing a description string longer than 1024 bytes.  
**Resolution:** Shorten the description to 1024 bytes or fewer.

---

### <a id="gov-19"></a>`19` — `InvalidTitle`

**Description:** Proposal title is empty or exceeds the maximum byte length.  
**Common cause:** Passing an empty string or a title over 128 bytes.  
**Resolution:** Provide a non-empty title of 1–128 bytes.

---

### <a id="gov-20"></a>`20` — `InvalidDescription`

**Description:** Proposal description is empty or exceeds the maximum byte length.  
**Common cause:** Passing an empty string or a description over 1024 bytes.  
**Resolution:** Provide a non-empty description of 1–1024 bytes.

---

### <a id="gov-21"></a>`21` — `InvalidDurationRange`

**Description:** Duration is outside the allowed `[MIN_DURATION, MAX_DURATION]` range.  
**Common cause:** Passing a duration shorter than the minimum (60 seconds) or longer than the maximum (2,592,000 seconds / 30 days).  
**Resolution:** Use a duration between 60 and 2,592,000 seconds inclusive.

---

### <a id="gov-22"></a>`22` — `QuorumExceedsSupply`

**Description:** Quorum exceeds the total token supply.  
**Common cause:** Setting a quorum higher than the total number of tokens in circulation, making the proposal impossible to pass.  
**Resolution:** Set quorum to a value ≤ `total_supply()` on the token contract.

---

### <a id="gov-23"></a>`23` — `VotingNotStarted`

**Description:** Voting period has not yet started.  
**Common cause:** Calling `cast_vote` before the proposal's `start_time` has been reached.  
**Resolution:** Wait until the ledger timestamp reaches the proposal's `start_time`.

---

### <a id="gov-24"></a>`24` — `InvalidNewAdmin`

**Description:** New admin address is invalid (e.g. zero address).  
**Common cause:** Passing the default/zero address as the `new_admin` argument to `transfer_admin`.  
**Resolution:** Provide a valid, non-zero Stellar account address as the new admin.

---

### <a id="gov-25"></a>`25` — `AdminVoteRestricted`

**Description:** Admin is not permitted to vote on their own proposals.  
**Common cause:** The contract was initialized with `restrict_admin_vote = true`, and the admin is attempting to vote on a proposal they created.  
**Resolution:** This is an intentional governance restriction. Use a separate account to vote, or re-initialize with `restrict_admin_vote = false` if the restriction is not desired.

---

### <a id="gov-26"></a>`26` — `ContractPaused`

**Description:** Contract is paused; all state-changing operations are blocked.  
**Common cause:** An admin called `pause()` to halt the contract, typically during an incident or upgrade.  
**Resolution:** Wait for the admin to call `unpause()`. Read-only operations (`get_proposal`, `has_voted`, etc.) remain available.

---

### <a id="gov-27"></a>`27` — `NotPaused`

**Description:** `unpause` was called but the contract is not currently paused.  
**Common cause:** Calling `unpause()` when the contract is already in the active (unpaused) state.  
**Resolution:** No action needed — the contract is already operational.

---

### <a id="gov-28"></a>`28` — `InvalidAddress`

**Description:** An address parameter is the zero/default address.  
**Common cause:** Passing an uninitialized or zero address where a valid account address is required.  
**Resolution:** Provide a valid, non-zero Stellar account or contract address.

---

### <a id="gov-29"></a>`29` — `ProposalCountOverflow`

**Description:** Proposal ID counter overflowed (`u64::MAX` reached).  
**Common cause:** Extremely unlikely in practice — would require creating 2⁶⁴ − 1 proposals.  
**Resolution:** This is a hard limit of the contract. Deploy a new contract instance if this limit is ever reached.

---

### <a id="gov-30"></a>`30` — `TimelockNotExpired`

**Description:** Timelock period has not yet expired; the proposal cannot be executed yet.  
**Common cause:** Calling `execute` before the mandatory delay (`execute_after` timestamp) has passed.  
**Resolution:** Wait until the ledger timestamp exceeds `proposal.execute_after`, then retry.

---

### <a id="gov-31"></a>`31` — `PendingAdminNotSet`

**Description:** No pending admin transfer has been proposed.  
**Common cause:** Calling `accept_admin_transfer` when no transfer has been initiated via `propose_admin_transfer`.  
**Resolution:** The current admin must call `propose_admin_transfer(new_admin)` first.

---

### <a id="gov-32"></a>`32` — `AdminTransferExpired`

**Description:** The admin transfer nomination window has expired.  
**Common cause:** The nominated admin did not call `accept_admin_transfer` within the allowed time window.  
**Resolution:** The current admin must call `propose_admin_transfer` again to restart the process.

---

### <a id="gov-33"></a>`33` — `NotPendingAdmin`

**Description:** Caller is not the pending (nominated) admin.  
**Common cause:** Calling `accept_admin_transfer` from an address other than the one nominated by `propose_admin_transfer`.  
**Resolution:** Only the nominated address can accept the transfer. Verify the pending admin address before calling.

---

### <a id="gov-34"></a>`34` — `DowngradeNotAllowed`

**Description:** Target version is lower than or equal to the current version (downgrade rejected).  
**Common cause:** Attempting to set the contract version to a value that is not strictly greater than the current version.  
**Resolution:** Provide a version tuple that is strictly greater than the current version returned by `get_version()`.

---

## Token Contract Errors

### <a id="tok-1"></a>`1` — `AdminNotSet`

**Description:** Token contract has not been initialized — no admin address is stored.  
**Common cause:** Calling any function before `initialize` has been invoked on the token contract.  
**Resolution:** Call `initialize(admin, initial_supply)` before invoking any other token function.

---

### <a id="tok-2"></a>`2` — `NotAdmin`

**Description:** Caller is not the token contract admin.  
**Common cause:** Calling `mint`, `burn`, or `transfer_admin` from a non-admin account.  
**Resolution:** Sign the transaction with the admin keypair used during token initialization.

---

### <a id="tok-3"></a>`3` — `InvalidAmount`

**Description:** The amount provided to `transfer`, `mint`, or `burn` is zero or negative.  
**Common cause:** Passing `0` or a negative value as the token amount.  
**Resolution:** Provide a positive integer amount greater than zero.

---

### <a id="tok-4"></a>`4` — `InsufficientBalance`

**Description:** The sender's token balance is less than the requested transfer or burn amount.  
**Common cause:** Attempting to transfer or burn more tokens than the address holds.  
**Resolution:** Check the sender's balance with `balance(address)` before initiating the operation and ensure sufficient funds.

---

### <a id="tok-5"></a>`5` — `AllowanceExceeded`

**Description:** The spender's approved allowance is less than the requested `transfer_from` amount.  
**Common cause:** Calling `transfer_from` without first calling `approve` with a sufficient amount, or the allowance has expired.  
**Resolution:** Call `approve(owner, spender, amount)` to set or increase the allowance before calling `transfer_from`. Note that allowances are stored in temporary storage and expire with the ledger entry TTL.

---

### <a id="tok-6"></a>`6` — `InvalidNewAdmin`

**Description:** New admin address is invalid (zero address).  
**Common cause:** Passing the default/zero address as the `new_admin` argument to `transfer_admin`.  
**Resolution:** Provide a valid, non-zero Stellar account address as the new admin.

---

### <a id="tok-7"></a>`7` — `InvalidAddress`

**Description:** An address parameter is the zero/default address.  
**Common cause:** Passing an uninitialized or zero address where a valid account address is required.  
**Resolution:** Provide a valid, non-zero Stellar account or contract address.

---

## Pre-flight Checks

Use these read-only calls before state-changing operations to avoid the most common errors:

| Before calling | Check first |
|----------------|-------------|
| `cast_vote` | `has_voted(proposal_id, voter)` → must be `false` |
| `cast_vote` | `get_proposal(proposal_id).state` → must be `Active` |
| `cast_vote` | `balance(voter)` on token contract → must be `> 0` |
| `finalise` | `get_proposal(proposal_id).end_time` → must be `< ledger_timestamp` |
| `execute` | `get_proposal(proposal_id).state` → must be `Passed` |
| `create_proposal` | `balance(proposer)` → must be `>= min_proposal_balance` |
| `transfer_from` | `allowance(owner, spender)` → must be `>= amount` |
