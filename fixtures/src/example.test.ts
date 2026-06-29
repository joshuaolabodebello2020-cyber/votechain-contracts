/**
 * Example test demonstrating RPC fixture usage.
 *
 * This file shows how to use the fixture library to mock Stellar RPC calls
 * in both backend and SDK tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockRpcServer, MockRpcServer, createProposalCountResponse } from './index';
import { rpc as StellarRpc, xdr } from '@stellar/stellar-sdk';

describe('RPC Fixture Library Examples', () => {
  let mockServer: MockRpcServer;

  beforeEach(() => {
    mockServer = mockRpcServer();
  });

  describe('Backend: fetchProposalCount', () => {
    it('returns proposal count from contract data', async () => {
      // Mock the getContractData response
      mockServer.getContractData.mockResolvedValue(
        createProposalCountResponse(42)
      );

      // Simulate the backend's fetchProposalCount logic
      const contractId = 'TEST_CONTRACT_ID';
      const entry = await mockServer.getContractData(
        contractId,
        xdr.ScVal.scvLedgerKeyContractInstance(),
        StellarRpc.Durability.Persistent
      );

      const instance = entry.val.contractData().val().instance();
      const storage = instance.storage();
      let count = 0;

      if (storage) {
        for (const item of storage) {
          const key = item.key().sym();
          if (key === 'ProposalCount') {
            count = Number(item.val().u32());
          }
        }
      }

      expect(count).toBe(42);
      expect(mockServer.getContractData).toHaveBeenCalledTimes(1);
    });

    it('handles contract data not found', async () => {
      mockServer.getContractData.mockRejectedValue(
        new Error('Contract data not found')
      );

      await expect(
        mockServer.getContractData(
          'TEST_CONTRACT_ID',
          xdr.ScVal.scvLedgerKeyContractInstance()
        )
      ).rejects.toThrow('Contract data not found');
    });
  });

  describe('SDK: getProposal via simulation', () => {
    it('returns proposal data from simulation', async () => {
      const { createGetProposalSimulationResponse } = await import('./fixtures/simulation.fixture');
      
      mockServer.simulateTransaction.mockResolvedValue(
        createGetProposalSimulationResponse(1, 'Test Proposal', 'Active')
      );

      const response = await mockServer.simulateTransaction({} as any);
      
      expect(response.result?.retval).toBeDefined();
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it('handles simulation errors', async () => {
      const { createSimulationErrorResponse } = await import('./fixtures/simulation.fixture');
      
      mockServer.simulateTransaction.mockResolvedValue(
        createSimulationErrorResponse('Insufficient fee')
      );

      const response = await mockServer.simulateTransaction({} as any);
      
      expect(response.result?.error).toBe('Insufficient fee');
    });
  });

  describe('SDK: sendTransaction', () => {
    it('returns successful transaction hash', async () => {
      const { createSendTransactionSuccessResponse } = await import('./fixtures/transaction.fixture');
      
      mockServer.sendTransaction.mockResolvedValue(
        createSendTransactionSuccessResponse('abc123')
      );

      const response = await mockServer.sendTransaction({} as any);
      
      expect(response.hash).toBe('abc123');
      expect(response.status).toBe('PENDING');
    });

    it('handles transaction errors', async () => {
      const { createSendTransactionErrorResponse } = await import('./fixtures/transaction.fixture');
      
      mockServer.sendTransaction.mockResolvedValue(
        createSendTransactionErrorResponse('tx_failed')
      );

      const response = await mockServer.sendTransaction({} as any);
      
      expect(response.status).toBe('ERROR');
      expect(response.errorResult).toBe('tx_failed');
    });
  });

  describe('Mock reset', () => {
    it('resets all mock calls', async () => {
      mockServer.getAccount.mockResolvedValue({} as any);
      mockServer.getContractData.mockResolvedValue({} as any);
      
      await mockServer.getAccount('test');
      await mockServer.getContractData('test', xdr.ScVal.scvVoid());

      expect(mockServer.getAccount).toHaveBeenCalledTimes(1);
      expect(mockServer.getContractData).toHaveBeenCalledTimes(1);

      mockServer.reset();

      expect(mockServer.getAccount).toHaveBeenCalledTimes(0);
      expect(mockServer.getContractData).toHaveBeenCalledTimes(0);
    });
  });
});
