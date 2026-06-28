/**
 * Contract data fixture for getContractData RPC calls.
 */

import { rpc as StellarRpc, xdr } from '@stellar/stellar-sdk';

/**
 * Creates a mock contract data response with proposal count in instance storage.
 */
export const createProposalCountResponse = (count: number): StellarRpc.Api.GetContractDataResponse => {
  const storageMap = new xdr.ScMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('ProposalCount'),
      val: xdr.ScVal.scvU32(count),
    }),
  ]);

  const instance = new xdr.ContractInstance({
    storage: storageMap,
    executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
  });

  return {
    key: xdr.LedgerKey.contract(
      new xdr.LedgerKeyContract({
        contractId: xdr.ScVal.scvBytes(Buffer.from('TEST_CONTRACT_ID', 'hex')),
      })
    ),
    val: xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        contract: xdr.ScVal.scvBytes(Buffer.from('TEST_CONTRACT_ID', 'hex')),
        val: xdr.ScVal.scvLedgerKeyContractInstance(),
        instance,
        durability: xdr.ContractDurability.persistent(),
      })
    ),
    lastModifiedLedgerSeq: 100,
    liveUntilLedgerSeq: undefined,
  };
};

/**
 * Creates a mock contract data response for a proposal.
 */
export const createProposalDataResponse = (
  proposalId: number,
  title: string,
  state: string
): StellarRpc.Api.GetContractDataResponse => {
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

  return {
    key: xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: xdr.ScVal.scvBytes(Buffer.from('TEST_CONTRACT_ID', 'hex')),
        key: xdr.ScVal.scvU64(proposalId),
        durability: xdr.ContractDurability.persistent(),
      })
    ),
    val: xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        contract: xdr.ScVal.scvBytes(Buffer.from('TEST_CONTRACT_ID', 'hex')),
        val: xdr.ScVal.scvVec([xdr.ScVal.scvMap(proposalMap)]),
        durability: xdr.ContractDurability.persistent(),
      })
    ),
    lastModifiedLedgerSeq: 100,
    liveUntilLedgerSeq: undefined,
  };
};

export const contractDataNotFoundResponse = new Error('Contract data not found');

export const contractDataErrorResponse = new Error('RPC Error: Failed to fetch contract data');
