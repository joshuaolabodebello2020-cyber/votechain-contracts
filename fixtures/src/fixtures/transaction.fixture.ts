/**
 * Transaction fixture for sendTransaction RPC calls.
 */

import { rpc as StellarRpc } from '@stellar/stellar-sdk';

/**
 * Creates a successful send transaction response.
 */
export const createSendTransactionSuccessResponse = (
  hash: string
): StellarRpc.Api.SendTransactionResponse => {
  return {
    hash,
    status: 'PENDING',
    errorResult: undefined,
    diagnosticEvents: [],
  };
};

/**
 * Creates an error send transaction response.
 */
export const createSendTransactionErrorResponse = (
  errorResult: string
): StellarRpc.Api.SendTransactionResponse => {
  return {
    hash: 'test-hash',
    status: 'ERROR',
    errorResult,
    diagnosticEvents: [],
  };
};

export const transactionSuccessResponse = createSendTransactionSuccessResponse(
  'abc123def456789'
);

export const transactionErrorResponse = createSendTransactionErrorResponse(
  'tx_failed'
);
