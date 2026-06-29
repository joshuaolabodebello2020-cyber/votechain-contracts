/**
 * Transaction simulation fixture for simulateTransaction RPC calls.
 */

import { rpc as StellarRpc, xdr } from '@stellar/stellar-sdk';

/**
 * Creates a successful simulation response.
 */
export const createSimulationSuccessResponse = (
  retval: xdr.ScVal,
  auth: xdr.SorobanAuthorizationEntry[] = []
): StellarRpc.Api.SimulateTransactionResponse => {
  return {
    id: 'test-simulation-id',
    events: [],
    minResourceFee: '100',
    cpuInstructions: 1000,
    memoryBytes: 100,
    result: {
      retval,
      auth,
    },
    cost: {
      cpuInsns: '1000',
      memBytes: '100',
    },
    latestLedger: 100,
  };
};

/**
 * Creates a simulation error response.
 */
export const createSimulationErrorResponse = (
  error: string
): StellarRpc.Api.SimulateTransactionResponse => {
  return {
    id: 'test-simulation-id',
    events: [],
    minResourceFee: '0',
    cpuInstructions: 0,
    memoryBytes: 0,
    result: {
      error,
      auth: [],
    },
    cost: {
      cpuInsns: '0',
      memBytes: '0',
    },
    latestLedger: 100,
  };
};

/**
 * Creates a simulation response for get_proposal call.
 */
export const createGetProposalSimulationResponse = (
  proposalId: number,
  title: string,
  state: string
): StellarRpc.Api.SimulateTransactionResponse => {
  const proposalMap = new xdr.ScMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('id'),
      val: xdr.ScVal.scvU64(proposalId),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('title'),
      val: xdr.ScVal.scvString(title),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('state'),
      val: xdr.ScVal.scvSymbol(state),
    }),
  ]);

  return createSimulationSuccessResponse(xdr.ScVal.scvMap(proposalMap));
};

/**
 * Creates a simulation response for has_voted call.
 */
export const createHasVotedSimulationResponse = (
  hasVoted: boolean
): StellarRpc.Api.SimulateTransactionResponse => {
  return createSimulationSuccessResponse(xdr.ScVal.scvBool(hasVoted));
};
