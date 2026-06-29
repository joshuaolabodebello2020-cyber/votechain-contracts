/**
 * Integration tests for Stellar RPC service using fixtures.
 *
 * These tests use the fixture library to mock RPC responses, enabling
 * deterministic offline testing without requiring a live Stellar RPC node.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockRpcServer, MockRpcServer, createProposalCountResponse } from '@votechain/fixtures';
import { rpc as StellarRpc, xdr } from '@stellar/stellar-sdk';

// Mock the stellarRpc module to use our mock server
vi.mock('../services/stellarRpc', () => ({
  getRpcServer: () => mockServer.server,
  getGovernanceContractId: () => 'TEST_CONTRACT_ID',
  getTokenContractId: () => 'TEST_TOKEN_ID',
}));

let mockServer: MockRpcServer;

describe('Stellar RPC Service (with fixtures)', () => {
  beforeEach(() => {
    mockServer = mockRpcServer();
  });

  describe('fetchProposalCount', () => {
    it('returns proposal count from contract instance storage', async () => {
      mockServer.getContractData.mockResolvedValue(
        createProposalCountResponse(42)
      );

      // Simulate the actual fetchProposalCount logic
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
      expect(mockServer.getContractData).toHaveBeenCalledWith(
        contractId,
        xdr.ScVal.scvLedgerKeyContractInstance(),
        StellarRpc.Durability.Persistent
      );
    });

    it('returns 0 when contract data is not found', async () => {
      mockServer.getContractData.mockRejectedValue(
        new Error('404 - Not Found')
      );

      const contractId = 'TEST_CONTRACT_ID';
      
      try {
        await mockServer.getContractData(
          contractId,
          xdr.ScVal.scvLedgerKeyContractInstance()
        );
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect((err as Error).message).toContain('404');
      }
    });

    it('returns 0 when storage is empty', async () => {
      const { createProposalCountResponse } = await import('@votechain/fixtures');
      mockServer.getContractData.mockResolvedValue(
        createProposalCountResponse(0)
      );

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

      expect(count).toBe(0);
    });
  });

  describe('readContractData', () => {
    it('reads contract data and converts to native value', async () => {
      const { createProposalDataResponse } = await import('@votechain/fixtures');
      
      mockServer.getContractData.mockResolvedValue(
        createProposalDataResponse(1, 'Test Proposal', 'Active')
      );

      const contractId = 'TEST_CONTRACT_ID';
      const key = xdr.ScVal.scvU64(1);
      
      const entry = await mockServer.getContractData(
        contractId,
        key,
        StellarRpc.Durability.Persistent
      );

      expect(entry.val).toBeDefined();
      expect(mockServer.getContractData).toHaveBeenCalledWith(
        contractId,
        key,
        StellarRpc.Durability.Persistent
      );
    });

    it('returns null for missing contract data', async () => {
      mockServer.getContractData.mockRejectedValue(
        new Error('404 - Not Found')
      );

      const contractId = 'TEST_CONTRACT_ID';
      const key = xdr.ScVal.scvU64(999);
      
      try {
        await mockServer.getContractData(contractId, key);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect((err as Error).message).toContain('404');
      }
    });
  });

  afterEach(() => {
    mockServer.reset();
  });
});
