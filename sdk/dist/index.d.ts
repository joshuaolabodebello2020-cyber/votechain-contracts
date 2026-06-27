import { Contract, Keypair, rpc as SorobanRpc } from "@stellar/stellar-sdk";
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
export declare class VoteChainSDK {
    readonly server: SorobanRpc.Server;
    readonly contract: Contract;
    readonly networkPassphrase: string;
    readonly fee: string;
    readonly timeoutSeconds: number;
    constructor(options: VoteChainOptions);
    private buildAndSubmit;
    private simulateCall;
    private static voteScVal;
    initialize(adminAddress: string, tokenContractId: string, signer: Keypair): Promise<TransactionResult>;
    createProposal(proposerKeypair: Keypair, title: string, description: string, quorum: bigint, durationSeconds: bigint): Promise<TransactionResult>;
    castVote(proposerKeypair: Keypair, proposalId: bigint, vote: VoteChoice): Promise<TransactionResult>;
    finalise(adminKeypair: Keypair, proposalId: bigint): Promise<TransactionResult>;
    execute(adminKeypair: Keypair, proposalId: bigint): Promise<TransactionResult>;
    cancel(adminKeypair: Keypair, proposalId: bigint): Promise<TransactionResult>;
    getProposal(proposalId: bigint, requesterPublicKey: string): Promise<any>;
    hasVoted(proposalId: bigint, voterAddress: string, requesterPublicKey: string): Promise<boolean>;
}
