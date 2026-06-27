# @votechain/sdk

A JavaScript and TypeScript SDK for interacting with VoteChain governance contracts on Stellar Soroban.

## Quick Start

Install the package:

```bash
npm install @votechain/sdk
```

Then use it in your application:

```ts
import { Keypair, Networks } from "@stellar/stellar-sdk";
import { VoteChainSDK, VoteChoice } from "@votechain/sdk";

const sdk = new VoteChainSDK({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  governanceContractId: "C...",
});

const admin = Keypair.fromSecret("S...");

const result = await sdk.createProposal(
  admin,
  "Increase treasury allocation",
  "Allocate 10% of the reserve for dev grants.",
  1000n,
  604800n
);

console.log(`Submitted proposal transaction: ${result.hash}`);
```

## Features

- Initialize governance with admin and token contract IDs
- Create proposals with quorum and voting duration
- Cast votes using typed `VoteChoice`
- Finalise, execute, and cancel proposals
- Read proposal state and vote status

## TypeScript support

This package ships with TypeScript declaration files. Import and use `VoteChainSDK`, `VoteChoice`, and the available methods with full type support.
