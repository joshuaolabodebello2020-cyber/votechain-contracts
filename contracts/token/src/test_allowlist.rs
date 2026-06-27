// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Tests for the allowlist minting phase and Merkle proof verification.

#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, BytesN, Env, Vec,
};

// ── test helpers ─────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, TokenContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(TokenContract, ());
    let client = TokenContractClient::new(&env, &id);
    client.initialize(&admin, &0_i128).unwrap();
    (env, admin, client)
}

/// Compute sha256 of 64 bytes (sorted pair of two 32-byte hashes).
fn hash_pair(env: &Env, a: [u8; 32], b: [u8; 32]) -> [u8; 32] {
    let (l, r) = if a <= b { (a, b) } else { (b, a) };
    let mut buf = [0u8; 64];
    buf[..32].copy_from_slice(&l);
    buf[32..].copy_from_slice(&r);
    let h = env.crypto().sha256(&soroban_sdk::Bytes::from_slice(env, &buf));
    let mut out = [0u8; 32];
    out.copy_from_slice(h.as_ref());
    out
}

/// Compute the leaf hash the same way the contract does.
fn leaf(env: &Env, addr: &Address, amount: i128) -> [u8; 32] {
    let addr_xdr = addr.to_xdr(env);
    let amount_bytes = amount.to_le_bytes();
    let mut buf = soroban_sdk::Bytes::new(env);
    buf.append(&addr_xdr);
    buf.append(&soroban_sdk::Bytes::from_slice(env, &amount_bytes));
    let h = env.crypto().sha256(&buf);
    let mut out = [0u8; 32];
    out.copy_from_slice(h.as_ref());
    out
}

fn bytes32(env: &Env, b: [u8; 32]) -> BytesN<32> {
    BytesN::from_array(env, &b)
}

// ── set_merkle_root ───────────────────────────────────────────────────────────

#[test]
fn test_set_merkle_root_by_admin_succeeds() {
    let (env, admin, client) = setup();
    let root = [1u8; 32];
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
}

#[test]
fn test_set_merkle_root_by_non_admin_fails() {
    let (env, _, client) = setup();
    let non_admin = Address::generate(&env);
    let result = client.try_set_merkle_root(&non_admin, &bytes32(&env, [2u8; 32]));
    assert!(
        matches!(result, Err(Ok(ContractError::NotAdmin))),
        "non-admin must not set Merkle root: {:?}", result
    );
}

#[test]
fn test_set_merkle_root_can_be_updated() {
    let (env, admin, client) = setup();
    client.set_merkle_root(&admin, &bytes32(&env, [1u8; 32])).unwrap();
    client.set_merkle_root(&admin, &bytes32(&env, [2u8; 32])).unwrap();
    // No error — root updated successfully
}

// ── set_sale_phase ────────────────────────────────────────────────────────────

#[test]
fn test_set_sale_phase_to_allowlist_by_admin() {
    let (env, admin, client) = setup();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();
    assert_eq!(client.get_sale_phase(), SalePhase::Allowlist);
}

#[test]
fn test_set_sale_phase_to_public_by_admin() {
    let (env, admin, client) = setup();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Public).unwrap();
    assert_eq!(client.get_sale_phase(), SalePhase::Public);
}

#[test]
fn test_set_sale_phase_by_non_admin_fails() {
    let (env, _, client) = setup();
    let non_admin = Address::generate(&env);
    let result = client.try_set_sale_phase(&non_admin, &SalePhase::Allowlist);
    assert!(
        matches!(result, Err(Ok(ContractError::NotAdmin))),
        "non-admin must not change sale phase: {:?}", result
    );
}

#[test]
fn test_default_sale_phase_is_public() {
    let (_, _, client) = setup();
    assert_eq!(client.get_sale_phase(), SalePhase::Public,
        "default phase must be Public");
}

// ── mint_allowlist: phase gate ────────────────────────────────────────────────

#[test]
fn test_mint_allowlist_fails_when_phase_is_public() {
    let (env, admin, client) = setup();
    // Phase defaults to Public — proof irrelevant
    let user = Address::generate(&env);
    let root = leaf(&env, &user, 100);
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    // Phase is still Public
    let result = client.try_mint_allowlist(&user, &100_i128, &Vec::new(&env));
    assert!(
        matches!(result, Err(Ok(ContractError::AllowlistNotEnabled))),
        "mint_allowlist must fail during Public phase: {:?}", result
    );
}

#[test]
fn test_mint_allowlist_fails_without_merkle_root() {
    let (env, admin, client) = setup();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();
    // No root set
    let user = Address::generate(&env);
    let result = client.try_mint_allowlist(&user, &100_i128, &Vec::new(&env));
    assert!(
        matches!(result, Err(Ok(ContractError::MerkleRootNotSet))),
        "must fail when no root set: {:?}", result
    );
}

// ── mint_allowlist: single-leaf tree (proof = empty) ─────────────────────────

#[test]
fn test_mint_allowlist_valid_proof_single_leaf() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    let amount = 500_i128;

    // Single-leaf tree: root == leaf
    let root = leaf(&env, &user, amount);
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    client.mint_allowlist(&user, &amount, &Vec::new(&env)).unwrap();

    assert_eq!(client.balance(&user), amount, "balance must equal minted amount");
    assert_eq!(client.total_supply(), amount, "total supply must include minted amount");
}

// ── mint_allowlist: two-leaf tree ─────────────────────────────────────────────

#[test]
fn test_mint_allowlist_valid_proof_two_leaf_tree() {
    let (env, admin, client) = setup();
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let amount_a = 300_i128;
    let amount_b = 700_i128;

    let leaf_a = leaf(&env, &user_a, amount_a);
    let leaf_b = leaf(&env, &user_b, amount_b);
    let root = hash_pair(&env, leaf_a, leaf_b);

    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Proof for user_a = [leaf_b]
    let mut proof_a = Vec::new(&env);
    proof_a.push_back(bytes32(&env, leaf_b));
    client.mint_allowlist(&user_a, &amount_a, &proof_a).unwrap();
    assert_eq!(client.balance(&user_a), amount_a);

    // Proof for user_b = [leaf_a]
    let mut proof_b = Vec::new(&env);
    proof_b.push_back(bytes32(&env, leaf_a));
    client.mint_allowlist(&user_b, &amount_b, &proof_b).unwrap();
    assert_eq!(client.balance(&user_b), amount_b);

    assert_eq!(client.total_supply(), amount_a + amount_b);
}

// ── mint_allowlist: four-leaf tree ────────────────────────────────────────────

#[test]
fn test_mint_allowlist_valid_proof_four_leaf_tree() {
    let (env, admin, client) = setup();

    let users: std::vec::Vec<Address> = (0..4).map(|_| Address::generate(&env)).collect();
    let amounts = [100_i128, 200, 300, 400];

    let leaves: std::vec::Vec<[u8; 32]> = users.iter().zip(amounts.iter())
        .map(|(u, &a)| leaf(&env, u, a))
        .collect();

    // Build tree: level1[0..1], root
    let l1_0 = hash_pair(&env, leaves[0], leaves[1]);
    let l1_1 = hash_pair(&env, leaves[2], leaves[3]);
    let root = hash_pair(&env, l1_0, l1_1);

    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Mint for user[0]: proof = [leaf[1], l1_1]
    let mut proof0 = Vec::new(&env);
    proof0.push_back(bytes32(&env, leaves[1]));
    proof0.push_back(bytes32(&env, l1_1));
    client.mint_allowlist(&users[0], &amounts[0], &proof0).unwrap();
    assert_eq!(client.balance(&users[0]), amounts[0]);

    // Mint for user[2]: proof = [leaf[3], l1_0]
    let mut proof2 = Vec::new(&env);
    proof2.push_back(bytes32(&env, leaves[3]));
    proof2.push_back(bytes32(&env, l1_0));
    client.mint_allowlist(&users[2], &amounts[2], &proof2).unwrap();
    assert_eq!(client.balance(&users[2]), amounts[2]);
}

// ── mint_allowlist: invalid proofs ────────────────────────────────────────────

#[test]
fn test_mint_allowlist_empty_proof_fails_for_two_leaf_tree() {
    let (env, admin, client) = setup();
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let leaf_a = leaf(&env, &user_a, 100);
    let leaf_b = leaf(&env, &user_b, 200);
    let root = hash_pair(&env, leaf_a, leaf_b);

    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Empty proof fails for a 2-leaf tree
    let result = client.try_mint_allowlist(&user_a, &100_i128, &Vec::new(&env));
    assert!(
        matches!(result, Err(Ok(ContractError::InvalidMerkleProof))),
        "empty proof must fail for 2-leaf tree: {:?}", result
    );
}

#[test]
fn test_mint_allowlist_wrong_sibling_fails() {
    let (env, admin, client) = setup();
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let leaf_a = leaf(&env, &user_a, 100);
    let leaf_b = leaf(&env, &user_b, 200);
    let root = hash_pair(&env, leaf_a, leaf_b);

    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Wrong sibling (all zeros)
    let mut bad_proof = Vec::new(&env);
    bad_proof.push_back(bytes32(&env, [0u8; 32]));
    let result = client.try_mint_allowlist(&user_a, &100_i128, &bad_proof);
    assert!(
        matches!(result, Err(Ok(ContractError::InvalidMerkleProof))),
        "wrong sibling must fail: {:?}", result
    );
}

#[test]
fn test_mint_allowlist_wrong_amount_fails() {
    let (env, admin, client) = setup();
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let leaf_a = leaf(&env, &user_a, 100);
    let leaf_b = leaf(&env, &user_b, 200);
    let root = hash_pair(&env, leaf_a, leaf_b);

    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Correct proof structure but wrong amount (99 instead of 100)
    let mut proof = Vec::new(&env);
    proof.push_back(bytes32(&env, leaf_b));
    let result = client.try_mint_allowlist(&user_a, &99_i128, &proof);
    assert!(
        matches!(result, Err(Ok(ContractError::InvalidMerkleProof))),
        "wrong amount must invalidate proof: {:?}", result
    );
}

#[test]
fn test_mint_allowlist_wrong_address_fails() {
    let (env, admin, client) = setup();
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let impersonator = Address::generate(&env);
    let leaf_a = leaf(&env, &user_a, 100);
    let leaf_b = leaf(&env, &user_b, 200);
    let root = hash_pair(&env, leaf_a, leaf_b);

    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Impersonator uses user_a's proof but calls with their own address
    let mut proof = Vec::new(&env);
    proof.push_back(bytes32(&env, leaf_b));
    let result = client.try_mint_allowlist(&impersonator, &100_i128, &proof);
    assert!(
        matches!(result, Err(Ok(ContractError::InvalidMerkleProof))),
        "wrong address must invalidate proof: {:?}", result
    );
}

#[test]
fn test_mint_allowlist_extra_proof_node_fails() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    let amount = 100_i128;
    let root = leaf(&env, &user, amount); // single-leaf root

    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Spurious extra proof node — root no longer matches
    let mut proof = Vec::new(&env);
    proof.push_back(bytes32(&env, [0xab; 32]));
    let result = client.try_mint_allowlist(&user, &amount, &proof);
    assert!(
        matches!(result, Err(Ok(ContractError::InvalidMerkleProof))),
        "extra proof node must fail: {:?}", result
    );
}

// ── phase switching ───────────────────────────────────────────────────────────

#[test]
fn test_switch_to_public_removes_proof_requirement() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);

    // Start in allowlist phase with a valid root
    let root = leaf(&env, &user, 100);
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Switch to public — normal admin mint now works
    client.set_sale_phase(&admin, &SalePhase::Public).unwrap();
    client.mint(&admin, &user, &100_i128).unwrap();
    assert_eq!(client.balance(&user), 100);
}

#[test]
fn test_switch_back_to_allowlist_re_enables_proof_requirement() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    let amount = 200_i128;

    // Set root, go Public, then go back to Allowlist
    let root = leaf(&env, &user, amount);
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Public).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Empty proof must now fail again
    let result = client.try_mint_allowlist(&user, &amount, &Vec::new(&env));
    assert!(
        matches!(result, Err(Ok(ContractError::InvalidMerkleProof))),
        "allowlist proof must be required after switching back: {:?}", result
    );

    // Valid proof succeeds
    client.mint_allowlist(&user, &amount, &Vec::new(&env)).unwrap(); // single-leaf
    assert_eq!(client.balance(&user), amount);
}

// ── existing mint unaffected ──────────────────────────────────────────────────

#[test]
fn test_existing_admin_mint_still_works_during_allowlist_phase() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);

    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Admin mint bypasses Merkle check entirely
    client.mint(&admin, &user, &500_i128).unwrap();
    assert_eq!(client.balance(&user), 500,
        "admin mint must still work during Allowlist phase");
}

// ── frozen account ────────────────────────────────────────────────────────────

#[test]
fn test_mint_allowlist_blocked_for_frozen_account() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    let amount = 100_i128;

    let root = leaf(&env, &user, amount);
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();
    client.freeze(&admin, &user).unwrap();

    let result = client.try_mint_allowlist(&user, &amount, &Vec::new(&env));
    assert!(
        matches!(result, Err(Ok(ContractError::AccountFrozen))),
        "frozen account must be rejected: {:?}", result
    );
}

// ── zero amount ───────────────────────────────────────────────────────────────

#[test]
fn test_mint_allowlist_zero_amount_rejected() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);

    // Leaf for amount=0
    let root = leaf(&env, &user, 0);
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    // Even with a technically valid proof, amount=0 must be rejected
    let result = client.try_mint_allowlist(&user, &0_i128, &Vec::new(&env));
    assert!(
        matches!(result, Err(Ok(ContractError::InvalidAmount))),
        "zero amount must be rejected: {:?}", result
    );
}

// ── supply accounting ─────────────────────────────────────────────────────────

#[test]
fn test_mint_allowlist_increases_total_supply() {
    let (env, admin, client) = setup();
    let user = Address::generate(&env);
    let amount = 1_000_i128;

    let root = leaf(&env, &user, amount);
    client.set_merkle_root(&admin, &bytes32(&env, root)).unwrap();
    client.set_sale_phase(&admin, &SalePhase::Allowlist).unwrap();

    let supply_before = client.total_supply();
    client.mint_allowlist(&user, &amount, &Vec::new(&env)).unwrap();
    assert_eq!(client.total_supply(), supply_before + amount,
        "total supply must increase by minted amount");
}
