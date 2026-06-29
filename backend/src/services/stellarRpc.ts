/**
 * Shared Stellar RPC client service.
 *
 * Centralises endpoint configuration and provides typed helpers for
 * fetching on-chain governance / proposal data from a Soroban RPC node.
 *
 * Required environment variables:
 *   STELLAR_RPC_URL          – e.g. https://soroban-testnet.stellar.org
 *   GOVERNANCE_CONTRACT_ID   – Bech32 contract address (C…)
 *   TOKEN_CONTRACT_ID        – Bech32 contract address (C…)
 */

import { rpc as StellarRpc, xdr, scValToNative } from "@stellar/stellar-sdk";
import { withTimeout, rpcTimeoutMs } from "../timeout";
import { withRetry, rpcRetryOptions } from "../retry";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

function createRpcServer(): StellarRpc.Server {
  const url = process.env.STELLAR_RPC_URL;
  if (!url) throw new Error("STELLAR_RPC_URL is not set");
  return new StellarRpc.Server(url, { allowHttp: url.startsWith("http://") });
}

let _server: StellarRpc.Server | null = null;

export function getRpcServer(): StellarRpc.Server {
  if (!_server) _server = createRpcServer();
  return _server;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function getGovernanceContractId(): string {
  const id = process.env.GOVERNANCE_CONTRACT_ID;
  if (!id) throw new Error("GOVERNANCE_CONTRACT_ID is not set");
  return id;
}

export function getTokenContractId(): string {
  const id = process.env.TOKEN_CONTRACT_ID;
  if (!id) throw new Error("TOKEN_CONTRACT_ID is not set");
  return id;
}

// ---------------------------------------------------------------------------
// On-chain data helpers
// ---------------------------------------------------------------------------

/**
 * Read a single persistent storage entry from a contract.
 * Returns the native JS value of the ScVal, or null if the entry is absent.
 */
export async function readContractData(
  contractId: string,
  key: xdr.ScVal,
  durability: StellarRpc.Durability = StellarRpc.Durability.Persistent
): Promise<unknown> {
  const server = getRpcServer();
  try {
    const entry = await withRetry(
      () => withTimeout(server.getContractData(contractId, key, durability), rpcTimeoutMs()),
      rpcRetryOptions()
    );
    const scVal = entry.val.contractData().val();
    return scValToNative(scVal);
  } catch (err: unknown) {
    if (isNotFoundError(err)) return null;
    throw wrapRpcError(err);
  }
}

/**
 * Fetch the total number of proposals stored in the governance contract
 * (reads the ProposalCount instance-storage key).
 */
export async function fetchProposalCount(): Promise<number> {
  const contractId = getGovernanceContractId();
  const server = getRpcServer();
  try {
    const entry = await withRetry(
      () => withTimeout(
        server.getContractData(
          contractId,
          xdr.ScVal.scvLedgerKeyContractInstance(),
          StellarRpc.Durability.Persistent
        ),
        rpcTimeoutMs()
      ),
      rpcRetryOptions()
    );
    const instance = entry.val.contractData().val().instance();
    const storage = instance.storage();
    if (!storage) return 0;
    for (const item of storage) {
      const k = scValToNative(item.key()) as unknown;
      if (k === "ProposalCount") {
        return Number(scValToNative(item.val()));
      }
    }
    return 0;
  } catch (err: unknown) {
    if (isNotFoundError(err)) return 0;
    throw wrapRpcError(err);
  }
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function isNotFoundError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.message.includes("404") ||
      err.message.toLowerCase().includes("not found")
    );
  }
  return false;
}

/** Wraps an unknown RPC error with a consistent message. */
export function wrapRpcError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(`Stellar RPC error: ${String(err)}`);
}
