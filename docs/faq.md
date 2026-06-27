# Frequently Asked Questions

## General

**Q: What is VoteChain?**  
A: VoteChain is a decentralized on-chain governance protocol built with Soroban smart contracts on the Stellar blockchain. It lets DAOs, protocols, and communities create proposals, cast token-weighted votes, enforce quorum, and execute decisions — all transparently and immutably on-chain.

**Q: What blockchain does VoteChain run on?**  
A: VoteChain runs on Stellar using the Soroban smart contract platform (SDK v22.0.0).

**Q: What is Soroban and why does VoteChain use it?**  
A: Soroban is Stellar's native smart contract environment. It provides the execution layer for complex logic like weighted voting, automated tallying, and state archival — capabilities not available with traditional Stellar operations.

**Q: Is VoteChain permissionless?**  
A: Proposal creation is open to any address. Voting requires holding governance tokens. Admin-only actions (execute, cancel, initialize) are restricted to the configured admin address.

---

## Proposal Creation

**Q: Who can create a proposal?**  
A: Any address can call `create_proposal`. There is no minimum token balance required to submit a proposal.

**Q: What information is required to create a proposal?**  
A: A proposal requires a title, description, quorum threshold (minimum total votes needed to pass), and a voting duration (measured in ledgers).

**Q: How long can a voting period last?**  
A: The duration is set by the proposer at creation time as a ledger count. There is no protocol-enforced maximum — it is up to the proposer and community convention.

**Q: Can a proposal be cancelled after creation?**  
A: Yes. The admin can cancel any Active proposal by calling `cancel(admin, proposal_id)`. Cancelled proposals cannot be reactivated.

---

## Voting Mechanics

**Q: What vote options are available?**  
A: Voters can choose one of three options: Yes, No, or Abstain.

**Q: How is vote weight determined?**  
A: Vote weight equals the voter's live governance token balance at the time they cast their vote. There are no snapshots — the balance is read directly from the token contract when `cast_vote` is called.

**Q: Can I change my vote after submitting?**  
A: No. Each address can vote exactly once per proposal. Attempting to vote again returns error `102 AlreadyVoted`.

**Q: Do Abstain votes count toward quorum?**  
A: Yes. Abstain votes contribute to `total_votes` and therefore count toward meeting the quorum threshold, but they do not count as Yes or No for the majority check.

---

## Token Requirements

**Q: Which token is used for voting?**  
A: The governance token is set during contract initialization via `initialize(admin, voting_token)`. It must be a Soroban-compatible token contract deployed on Stellar.

**Q: What balance do I need to vote?**  
A: Any non-zero balance of the governance token allows you to vote. Your vote weight is proportional to your balance — a larger balance carries more weight.

**Q: What happens if I transfer tokens after voting?**  
A: Your vote is already recorded and cannot be changed. Token transfers after voting have no effect on the current proposal, but will affect your weight in future proposals.

---

## Quorum & Finalisation

**Q: How does quorum work?**  
A: Each proposal has a `quorum` value set at creation. For a proposal to pass, two conditions must both be true:
```
total_votes >= quorum  AND  votes_yes > votes_no
```
If quorum is not reached, the proposal is Rejected regardless of the Yes/No split.

**Q: Who finalises a proposal?**  
A: Anyone can call `finalise(proposal_id)` after the voting period ends. The contract evaluates the pass conditions and transitions the proposal to Passed or Rejected.

**Q: What happens after a proposal passes?**  
A: A Passed proposal must be explicitly executed by the admin via `execute(admin, proposal_id)`, which transitions it to the Executed state. Execution is a manual step — VoteChain does not automatically trigger cross-contract calls.

**Q: Can I query the current state of a proposal?**  
A: Yes. Call `get_proposal(proposal_id)` to read the full proposal state, or `has_voted(proposal_id, voter)` to check whether a specific address has already voted.

---

## Errors

**Q: What do the contract error codes mean?**

| Code | Name | Cause |
|------|------|-------|
| 101 | Unauthorized | Caller is not the admin or required signer |
| 102 | AlreadyVoted | Address has already voted on this proposal |
| 103 | ProposalExpired | Voting period has ended |
| 104 | InsufficientStake | Voter holds no governance tokens |
| 105 | InvalidStatus | Proposal is not in the required state for the operation |

---

## Token Setup & Integration {#token-setup}

**Q: How do I deploy and configure the governance token?**  
A: Deploy the `votechain_token` contract first, then pass its address to `GovernanceContract::initialize` as the `voting_token` parameter. The token must implement the SEP-41 interface (`balance`, `transfer`, `mint`, `burn`). Example:
```rust
let token_id = env.register(TokenContract, ());
let tok = TokenContractClient::new(&env, &token_id);
tok.initialize(&admin, &1_000_000_000);

governance.initialize(&admin, &token_id, &0, &0, &60, &2_592_000, &false, &0);
```

**Q: Can I use an existing Stellar asset (classic asset) as the voting token?**  
A: Not directly. VoteChain requires a Soroban-native token contract that exposes the `balance` function. You can wrap a classic Stellar asset using the Stellar Asset Contract (SAC) and pass the SAC address as `voting_token`.

**Q: How do I distribute governance tokens to DAO members?**  
A: Call `TokenContract::mint(admin, recipient, amount)` for each member. Only the token admin can mint. For a fair launch, consider minting all tokens at initialization and distributing via transfers, or using a vesting contract.

**Q: Can the voting token be changed after initialization?**  
A: No. The `voting_token` address is set once at initialization and is immutable. To change it, you would need to deploy a new governance contract.

---

## Quorum Configuration {#quorum-config}

**Q: How should I choose a quorum value?**  
A: Quorum should reflect the minimum participation you consider legitimate. A common starting point is 10–20% of total token supply. For example, with 1 billion tokens in circulation, a quorum of 100 million (10%) means at least 100M tokens must vote for the result to be binding.

**Q: Can quorum be updated after a proposal is created?**  
A: Yes, but only by the admin and only while the proposal is still Active. Call `update_quorum(admin, proposal_id, new_quorum)`. This cannot be called after the voting period ends.

**Q: What happens if quorum is set to zero?**  
A: `create_proposal` will return `InvalidQuorum`. Quorum must be a positive value greater than zero.

**Q: Can quorum exceed the total token supply?**  
A: No. The contract checks `quorum <= total_supply` at proposal creation and when `update_quorum` is called. Exceeding the supply returns `QuorumExceedsSupply`.

---

## Upgrade Path {#upgrade-path}

**Q: How do I upgrade the governance contract?**  
A: VoteChain uses a semantic versioning guard. Call `upgrade(admin, (major, minor, patch))` with a strictly higher version than the current one. Downgrades and same-version upgrades are rejected with `DowngradeNotAllowed`. See [docs/upgrading.md](upgrading.md) for the full procedure.

**Q: Is contract state preserved during an upgrade?**  
A: Yes. The upgrade only changes the contract's WASM bytecode. All persistent storage (proposals, vote records, balances) remains intact because it is stored in Soroban's persistent ledger entries, not in the WASM binary.

**Q: Do I need to re-initialize after an upgrade?**  
A: No. Re-initialization is blocked by the `AlreadyInitialized` guard. The existing admin, token address, and configuration carry over automatically.

**Q: How do I upgrade the token contract?**  
A: The token contract follows the same versioning pattern. Call `TokenContract::upgrade(admin, new_version)`. Token balances and allowances are unaffected.

---

## Event Indexing {#event-indexing}

**Q: What events does VoteChain emit?**  
A: Every state-changing operation emits a Soroban contract event. Key events include:
- `proposal_created` — new proposal with ID, proposer, quorum, duration
- `vote_cast` — voter address, proposal ID, vote type, weight
- `proposal_finalised` — proposal ID, outcome (Passed/Rejected), vote totals
- `proposal_executed` — proposal ID
- `proposal_cancelled` — proposal ID

See [docs/events.md](events.md) for the full event schema.

**Q: How do I index VoteChain events off-chain?**  
A: Use the Stellar RPC `getEvents` endpoint filtered by the governance contract address. The repo includes a reference indexer in `indexer/` that streams events into a PostgreSQL database. Run it with:
```bash
cargo run -p votechain-indexer -- --contract-id <GOVERNANCE_CONTRACT_ID>
```

**Q: Are events available for historical proposals?**  
A: Events are stored on-chain and accessible via the Stellar RPC for as long as the ledger entries are within the archival window (typically 1 year on mainnet). For long-term retention, run the indexer continuously or use a third-party indexing service.

**Q: Can I filter events by proposal ID?**  
A: Yes. Each event includes the proposal ID as a topic. Use the `topic` filter in `getEvents` to retrieve all events for a specific proposal:
```json
{ "topics": [["proposal_created", "<proposal_id>"]] }
```

---

## DAO Operations {#dao-operations}

**Q: How do I pause the contract in an emergency?**  
A: Call `GovernanceContract::pause(admin)`. While paused, all state-changing operations (`create_proposal`, `cast_vote`, etc.) are blocked. Read-only calls (`get_proposal`, `has_voted`) remain available. Resume with `unpause(admin)`.

**Q: Can the admin vote on proposals they created?**  
A: This is configurable. Set `restrict_admin_vote = true` during initialization to prevent the admin from voting on their own proposals. If `false`, the admin can vote like any other token holder.

**Q: How do I transfer admin privileges to a multisig?**  
A: Call `transfer_admin(current_admin, new_admin)` where `new_admin` is the address of a Soroban multisig contract or a new EOA. The transfer is immediate and irreversible without the new admin's cooperation.

**Q: What is the proposal cooldown and how does it work?**  
A: The cooldown (`proposal_cooldown`) is a per-address rate limit in seconds. After creating a proposal, the same address cannot create another until the cooldown expires. Set to `0` to disable. This prevents spam proposals.
