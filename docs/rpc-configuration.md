# RPC Configuration

This document describes how to configure the Stellar/Soroban RPC endpoint used by the VoteChain backend.

## Overview

The backend (`backend/`) connects to a Soroban RPC node to read on-chain governance and proposal data. All RPC logic is centralised in `backend/src/services/stellarRpc.ts`.

## Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `STELLAR_RPC_URL` | Yes | Full URL of the Soroban RPC node | `https://soroban-testnet.stellar.org` |
| `GOVERNANCE_CONTRACT_ID` | Yes | Bech32 address of the deployed governance contract | `CABC...` |
| `TOKEN_CONTRACT_ID` | Yes | Bech32 address of the deployed token contract | `CDEF...` |
| `PORT` | No | HTTP port for the Express server (default `3001`) | `3001` |

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

## Network Endpoints

| Network | RPC URL |
|---|---|
| Local | `http://localhost:8000` |
| Testnet | `https://soroban-testnet.stellar.org` |
| Mainnet | `https://soroban-mainnet.stellar.org` |

## Error Handling

The RPC service surfaces errors consistently:

- **502 Bad Gateway** — returned to API callers when the RPC node is unreachable or returns an error.
- **404 Not Found** — returned when a proposal ID does not exist on-chain.
- **400 Bad Request** — returned when the caller supplies an invalid parameter (e.g. non-numeric proposal ID).

All RPC errors are logged to `stderr` with the originating route for easy debugging.

## Architecture

```
Express routes
  └── backend/src/services/stellarRpc.ts   ← single RPC client (singleton)
        └── @stellar/stellar-sdk  rpc.Server
              └── Soroban RPC node (STELLAR_RPC_URL)
                    └── On-chain contracts
```

The `getRpcServer()` function lazily instantiates a single `rpc.Server` instance reused across all requests.
