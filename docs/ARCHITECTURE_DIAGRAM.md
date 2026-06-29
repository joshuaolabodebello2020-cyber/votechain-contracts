# Governance Workflow Architecture

This document shows how VoteChain's components interact during the governance lifecycle: proposal creation, voting, finalization, and execution.

---

## System Overview

```mermaid
graph TB
    subgraph "User Interfaces"
        UI[Frontend<br/>React + Vite<br/>:5173]
        SDK["@votechain/sdk<br/>TypeScript"]
        ExtAPI[External Integrators]
    end

    subgraph "Off-Chain Services"
        BE[Backend API<br/>Node.js<br/>:3001]
        IDX[Indexer<br/>Event Listener]
        Redis[(Redis<br/>Cache)]
    end

    subgraph "Stellar Network"
        RPC[Stellar RPC<br/>:8000]
        GOV[Governance Contract<br/>Soroban WASM]
        TOK[Token Contract<br/>SEP-41 WASM]
    end

    UI -->|Submit tx via| RPC
    UI -->|Read aggregated data| BE
    SDK -->|Submit tx via| RPC
    ExtAPI -->|REST calls| BE

    BE -->|Query state| RPC
    BE <-->|Cache| Redis

    IDX -->|Subscribe to events| RPC
    IDX -->|Write events| BE

    RPC <-->|Invoke| GOV
    RPC <-->|Invoke| TOK
    GOV -->|Check balances| TOK
```

---

## Governance Flow: Proposal Creation → Execution

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant RPC as Stellar RPC
    participant Gov as Governance Contract
    participant Token as Token Contract
    participant Indexer
    participant Backend

    Note over User, Backend: 1. Proposal Creation
    User->>Frontend: Fill proposal form
    Frontend->>RPC: create_proposal(title, desc, quorum, duration)
    RPC->>Gov: Invoke create_proposal()
    Gov->>Gov: Validate params, set end_time
    Gov-->>RPC: Emit ProposalCreated event
    RPC-->>Frontend: Transaction result
    Indexer->>RPC: Detect ProposalCreated event
    Indexer->>Backend: Store proposal metadata

    Note over User, Backend: 2. Voting
    User->>Frontend: Cast vote (Yes/No)
    Frontend->>RPC: cast_vote(proposal_id, vote)
    RPC->>Gov: Invoke cast_vote()
    Gov->>Token: Query voter balance
    Token-->>Gov: Return balance (vote weight)
    Gov->>Gov: Record vote, update tallies
    Gov-->>RPC: Emit VoteCast event
    RPC-->>Frontend: Transaction result
    Indexer->>RPC: Detect VoteCast event
    Indexer->>Backend: Update vote tallies

    Note over User, Backend: 3. Finalization
    User->>Frontend: Trigger finalize
    Frontend->>RPC: finalise(proposal_id)
    RPC->>Gov: Invoke finalise()
    Gov->>Gov: Check end_time passed
    Gov->>Gov: Evaluate quorum + vote ratio
    Gov->>Gov: Set state → Passed or Rejected
    Gov-->>RPC: Emit ProposalFinalized event
    RPC-->>Frontend: Final state
    Indexer->>RPC: Detect ProposalFinalized event
    Indexer->>Backend: Update proposal state

    Note over User, Backend: 4. Execution (admin only)
    User->>Frontend: Execute passed proposal
    Frontend->>RPC: execute(proposal_id)
    RPC->>Gov: Invoke execute()
    Gov->>Gov: Verify state == Passed, caller == admin
    Gov->>Gov: Set state → Executed
    Gov-->>RPC: Emit ProposalExecuted event
    RPC-->>Frontend: Confirmation
    Indexer->>RPC: Detect ProposalExecuted event
    Indexer->>Backend: Mark executed
```

---

## Data Flow Summary

| Stage | User Action | Contract Call | Data Written | Event Emitted |
|-------|------------|---------------|-------------|---------------|
| Create | Submit proposal form | `create_proposal()` | Proposal record (on-chain) | `ProposalCreated` |
| Vote | Cast Yes/No vote | `cast_vote()` | Vote record + updated tallies | `VoteCast` |
| Finalize | Trigger finalization | `finalise()` | Updated proposal state | `ProposalFinalized` |
| Execute | Admin executes | `execute()` | State → Executed | `ProposalExecuted` |
| Cancel | Admin cancels | `cancel()` | State → Cancelled | `ProposalCancelled` |

---

## Component Responsibilities

| Component | Role in Governance |
|-----------|--------------------|
| **Frontend** | User-facing proposal browser and voting interface. Submits transactions directly to Stellar RPC. |
| **Backend API** | Serves aggregated data (proposal lists, vote histories) from the indexer store. Does not submit on-chain transactions. |
| **Indexer** | Subscribes to on-chain events and writes them to the backend store for fast querying. |
| **Governance Contract** | Core logic: proposal CRUD, vote recording, quorum evaluation, state transitions. |
| **Token Contract** | Provides token balances used as vote weights. Manages mint/burn/transfer/allowances. |
| **SDK** | TypeScript wrappers for contract calls. Used by the frontend and external integrators. |
| **Stellar RPC** | Network gateway for submitting transactions and querying on-chain state. |
