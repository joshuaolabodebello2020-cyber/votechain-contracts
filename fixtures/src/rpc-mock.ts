/**
 * Mock Stellar RPC Server for deterministic testing.
 *
 * Provides a mock implementation of SorobanRpc.Server that returns
 * pre-canned responses, enabling offline, deterministic tests.
 */

import { rpc as StellarRpc, xdr, Account } from '@stellar/stellar-sdk';

export interface MockRpcServer {
  server: jest.Mocked<StellarRpc.Server>;
  getAccount: jest.MockedFunction<(address: string) => Promise<Account>>;
  getContractData: jest.MockedFunction<(
    contractId: string,
    key: xdr.ScVal,
    durability?: StellarRpc.Durability
  ) => Promise<StellarRpc.Api.GetContractDataResponse>>;
  simulateTransaction: jest.MockedFunction<(
    transaction: StellarRpc.Transaction
  ) => Promise<StellarRpc.Api.SimulateTransactionResponse>>;
  sendTransaction: jest.MockedFunction<(
    transaction: StellarRpc.Transaction
  ) => Promise<StellarRpc.Api.SendTransactionResponse>>;
  getLedger: jest.MockedFunction<(sequence: number | string) => Promise<StellarRpc.Api.GetLedgerResponse>>;
  getLatestLedger: jest.MockedFunction<() => Promise<StellarRpc.Api.GetLedgerResponse>>;
  reset: () => void;
}

/**
 * Creates a mock RPC server with all methods mocked.
 *
 * @example
 * ```ts
 * const mockServer = mockRpcServer();
 * mockServer.getAccount.returns(mockAccountResponse);
 * ```
 */
export function mockRpcServer(): MockRpcServer {
  const server = {
    getAccount: jest.fn(),
    getContractData: jest.fn(),
    simulateTransaction: jest.fn(),
    sendTransaction: jest.fn(),
    getLedger: jest.fn(),
    getLatestLedger: jest.fn(),
  } as unknown as jest.Mocked<StellarRpc.Server>;

  const mockServer: MockRpcServer = {
    server,
    getAccount: server.getAccount as jest.MockedFunction<any>,
    getContractData: server.getContractData as jest.MockedFunction<any>,
    simulateTransaction: server.simulateTransaction as jest.MockedFunction<any>,
    sendTransaction: server.sendTransaction as jest.MockedFunction<any>,
    getLedger: server.getLedger as jest.MockedFunction<any>,
    getLatestLedger: server.getLatestLedger as jest.MockedFunction<any>,
    reset: () => {
      server.getAccount.mockReset();
      server.getContractData.mockReset();
      server.simulateTransaction.mockReset();
      server.sendTransaction.mockReset();
      server.getLedger.mockReset();
      server.getLatestLedger.mockReset();
    },
  };

  return mockServer;
}

/**
 * Creates a mock SorobanRpc.Server instance for use in tests.
 *
 * This is useful when you need to pass a server instance to a constructor
 * but want to control its behavior via mocks.
 */
export function createMockServer(): jest.Mocked<StellarRpc.Server> {
  return {
    getAccount: jest.fn(),
    getContractData: jest.fn(),
    simulateTransaction: jest.fn(),
    sendTransaction: jest.fn(),
    getLedger: jest.fn(),
    getLatestLedger: jest.fn(),
    getHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
    getFeeStats: jest.fn().mockResolvedValue({}),
    getSponsorshipStats: jest.fn().mockResolvedValue({}),
    getNetwork: jest.fn().mockResolvedValue({
      friendbotUrl: 'https://friendbot.stellar.org',
      passphrase: 'Test SDF Network ; September 2015',
    }),
  } as unknown as jest.Mocked<StellarRpc.Server>;
}
