/**
 * Account fixture for getAccount RPC calls.
 */

import { Account } from '@stellar/stellar-sdk';

export const defaultAccountResponse: Account = {
  accountId: 'GD5WJFBXVTEO4XG2R4J4XQCNF7XJN5LQK7YQV7ZQJ7XJN5LQK7YQV7Z',
  balance: '10000000000',
  sequence: '1234567890',
  numSubentries: 0,
  inflationDest: undefined,
  flags: 0,
  lastModifiedLedgerSeq: 100,
  subentries: [],
  signers: [],
  thresholds: { low: 1, medium: 2, high: 3 },
};

export const createAccountResponse = (
  overrides?: Partial<Account>
): Account => {
  return {
    ...defaultAccountResponse,
    ...overrides,
  };
};

export const accountNotFoundResponse = new Error('Account not found');

export const accountErrorResponse = new Error('RPC Error: Failed to fetch account');
