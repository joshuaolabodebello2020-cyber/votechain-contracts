import {
  Contract,
  Keypair,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";

export type VoteChoice = "Yes" | "No" | "Abstain";

export interface VoteChainOptions {
  rpcUrl: string;
  networkPassphrase: string;
  governanceContractId: string;
  fee?: string;
  timeoutSeconds?: number;
}

export interface TransactionResult {
  hash: string;
  status: string;
  errorResult?: string;
}

export class VoteChainSDK {
  readonly server: SorobanRpc.Server;
  readonly contract: Contract;
  readonly networkPassphrase: string;
  readonly fee: string;
  readonly timeoutSeconds: number;

  constructor(options: VoteChainOptions) {
    this.server = new SorobanRpc.Server(options.rpcUrl);
    this.contract = new Contract(options.governanceContractId);
    this.networkPassphrase = options.networkPassphrase;
    this.fee = options.fee ?? "100";
    this.timeoutSeconds = options.timeoutSeconds ?? 30;
  }

  private async buildAndSubmit(operation: any, signer: Keypair): Promise<TransactionResult> {
    const account = await this.server.getAccount(signer.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: this.fee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(this.timeoutSeconds)
      .build();

    const simulation = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simulation).build();
    preparedTx.sign(signer);

    const sendResult = await this.server.sendTransaction(preparedTx);
    if (sendResult.status === "ERROR") {
      throw new Error(`Transaction failed: ${sendResult.errorResult}`);
    }

    return sendResult as TransactionResult;
  }

  private async simulateCall(operation: any, accountPublicKey: string): Promise<any> {
    const account = await this.server.getAccount(accountPublicKey);
    const tx = new TransactionBuilder(account, {
      fee: this.fee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(this.timeoutSeconds)
      .build();

    const simulation = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    return simulation.result?.retval;
  }

  private static voteScVal(vote: VoteChoice): xdr.ScVal {
    return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(vote)]);
  }

  async initialize(adminAddress: string, tokenContractId: string, signer: Keypair): Promise<TransactionResult> {
    const operation = this.contract.call(
      "initialize",
      nativeToScVal(adminAddress, { type: "address" }),
      nativeToScVal(tokenContractId, { type: "address" })
    );
    return this.buildAndSubmit(operation, signer);
  }

  async createProposal(
    proposerKeypair: Keypair,
    title: string,
    description: string,
    quorum: bigint,
    durationSeconds: bigint
  ): Promise<TransactionResult> {
    const operation = this.contract.call(
      "create_proposal",
      nativeToScVal(proposerKeypair.publicKey(), { type: "address" }),
      nativeToScVal(title, { type: "string" }),
      nativeToScVal(description, { type: "string" }),
      nativeToScVal(quorum, { type: "i128" }),
      nativeToScVal(durationSeconds, { type: "u64" })
    );
    return this.buildAndSubmit(operation, proposerKeypair);
  }

  async castVote(proposerKeypair: Keypair, proposalId: bigint, vote: VoteChoice): Promise<TransactionResult> {
    const operation = this.contract.call(
      "cast_vote",
      nativeToScVal(proposerKeypair.publicKey(), { type: "address" }),
      nativeToScVal(proposalId, { type: "u64" }),
      VoteChainSDK.voteScVal(vote)
    );
    return this.buildAndSubmit(operation, proposerKeypair);
  }

  async finalise(adminKeypair: Keypair, proposalId: bigint): Promise<TransactionResult> {
    const operation = this.contract.call(
      "finalise",
      nativeToScVal(proposalId, { type: "u64" })
    );
    return this.buildAndSubmit(operation, adminKeypair);
  }

  async execute(adminKeypair: Keypair, proposalId: bigint): Promise<TransactionResult> {
    const operation = this.contract.call(
      "execute",
      nativeToScVal(adminKeypair.publicKey(), { type: "address" }),
      nativeToScVal(proposalId, { type: "u64" })
    );
    return this.buildAndSubmit(operation, adminKeypair);
  }

  async cancel(adminKeypair: Keypair, proposalId: bigint): Promise<TransactionResult> {
    const operation = this.contract.call(
      "cancel",
      nativeToScVal(adminKeypair.publicKey(), { type: "address" }),
      nativeToScVal(proposalId, { type: "u64" })
    );
    return this.buildAndSubmit(operation, adminKeypair);
  }

  async getProposal(proposalId: bigint, requesterPublicKey: string): Promise<any> {
    return this.simulateCall(
      this.contract.call(
        "get_proposal",
        nativeToScVal(proposalId, { type: "u64" })
      ),
      requesterPublicKey
    );
  }

  async hasVoted(proposalId: bigint, voterAddress: string, requesterPublicKey: string): Promise<boolean> {
    const result = await this.simulateCall(
      this.contract.call(
        "has_voted",
        nativeToScVal(proposalId, { type: "u64" }),
        nativeToScVal(voterAddress, { type: "address" })
      ),
      requesterPublicKey
    );
    return Boolean(result);
  }
}
