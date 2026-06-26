"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteChainSDK = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
class VoteChainSDK {
    constructor(options) {
        this.server = new stellar_sdk_1.rpc.Server(options.rpcUrl);
        this.contract = new stellar_sdk_1.Contract(options.governanceContractId);
        this.networkPassphrase = options.networkPassphrase;
        this.fee = options.fee ?? "100";
        this.timeoutSeconds = options.timeoutSeconds ?? 30;
    }
    async buildAndSubmit(operation, signer) {
        const account = await this.server.getAccount(signer.publicKey());
        const tx = new stellar_sdk_1.TransactionBuilder(account, {
            fee: this.fee,
            networkPassphrase: this.networkPassphrase,
        })
            .addOperation(operation)
            .setTimeout(this.timeoutSeconds)
            .build();
        const simulation = await this.server.simulateTransaction(tx);
        if (stellar_sdk_1.rpc.Api.isSimulationError(simulation)) {
            throw new Error(`Simulation failed: ${simulation.error}`);
        }
        const preparedTx = stellar_sdk_1.rpc.assembleTransaction(tx, simulation).build();
        preparedTx.sign(signer);
        const sendResult = await this.server.sendTransaction(preparedTx);
        if (sendResult.status === "ERROR") {
            throw new Error(`Transaction failed: ${sendResult.errorResult}`);
        }
        return sendResult;
    }
    async simulateCall(operation, accountPublicKey) {
        const account = await this.server.getAccount(accountPublicKey);
        const tx = new stellar_sdk_1.TransactionBuilder(account, {
            fee: this.fee,
            networkPassphrase: this.networkPassphrase,
        })
            .addOperation(operation)
            .setTimeout(this.timeoutSeconds)
            .build();
        const simulation = await this.server.simulateTransaction(tx);
        if (stellar_sdk_1.rpc.Api.isSimulationError(simulation)) {
            throw new Error(`Simulation failed: ${simulation.error}`);
        }
        return simulation.result?.retval;
    }
    static voteScVal(vote) {
        return stellar_sdk_1.xdr.ScVal.scvVec([stellar_sdk_1.xdr.ScVal.scvSymbol(vote)]);
    }
    async initialize(adminAddress, tokenContractId, signer) {
        const operation = this.contract.call("initialize", (0, stellar_sdk_1.nativeToScVal)(adminAddress, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(tokenContractId, { type: "address" }));
        return this.buildAndSubmit(operation, signer);
    }
    async createProposal(proposerKeypair, title, description, quorum, durationSeconds) {
        const operation = this.contract.call("create_proposal", (0, stellar_sdk_1.nativeToScVal)(proposerKeypair.publicKey(), { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(title, { type: "string" }), (0, stellar_sdk_1.nativeToScVal)(description, { type: "string" }), (0, stellar_sdk_1.nativeToScVal)(quorum, { type: "i128" }), (0, stellar_sdk_1.nativeToScVal)(durationSeconds, { type: "u64" }));
        return this.buildAndSubmit(operation, proposerKeypair);
    }
    async castVote(proposerKeypair, proposalId, vote) {
        const operation = this.contract.call("cast_vote", (0, stellar_sdk_1.nativeToScVal)(proposerKeypair.publicKey(), { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" }), VoteChainSDK.voteScVal(vote));
        return this.buildAndSubmit(operation, proposerKeypair);
    }
    async finalise(adminKeypair, proposalId) {
        const operation = this.contract.call("finalise", (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" }));
        return this.buildAndSubmit(operation, adminKeypair);
    }
    async execute(adminKeypair, proposalId) {
        const operation = this.contract.call("execute", (0, stellar_sdk_1.nativeToScVal)(adminKeypair.publicKey(), { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" }));
        return this.buildAndSubmit(operation, adminKeypair);
    }
    async cancel(adminKeypair, proposalId) {
        const operation = this.contract.call("cancel", (0, stellar_sdk_1.nativeToScVal)(adminKeypair.publicKey(), { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" }));
        return this.buildAndSubmit(operation, adminKeypair);
    }
    async getProposal(proposalId, requesterPublicKey) {
        return this.simulateCall(this.contract.call("get_proposal", (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" })), requesterPublicKey);
    }
    async hasVoted(proposalId, voterAddress, requesterPublicKey) {
        const result = await this.simulateCall(this.contract.call("has_voted", (0, stellar_sdk_1.nativeToScVal)(proposalId, { type: "u64" }), (0, stellar_sdk_1.nativeToScVal)(voterAddress, { type: "address" })), requesterPublicKey);
        return Boolean(result);
    }
}
exports.VoteChainSDK = VoteChainSDK;
