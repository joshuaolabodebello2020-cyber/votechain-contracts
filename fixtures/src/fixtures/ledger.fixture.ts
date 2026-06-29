/**
 * Ledger fixture for getLedger and getLatestLedger RPC calls.
 */

import { rpc as StellarRpc } from '@stellar/stellar-sdk';

/**
 * Creates a ledger response.
 */
export const createLedgerResponse = (
  sequence: number,
  timestamp: number
): StellarRpc.Api.GetLedgerResponse => {
  return {
    id: 'test-ledger-id',
    sequence,
    timestamp,
    protocolVersion: 20,
    headerXdr: 'test-header-xdr',
  };
};

export const defaultLedgerResponse = createLedgerResponse(100, 1234567890);

export const latestLedgerResponse = createLedgerResponse(100, 1234567890);
