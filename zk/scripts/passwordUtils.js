// Converts an arbitrary human-readable password string into the field
// element used as the circuit's `secret` input, and computes its Poseidon
// hash (what the deployer stores on-chain as `passwordHash`).
//
// Used by both the deployer (to compute passwordHash for the constructor)
// and the frontend (to compute the same `secret` field element when
// generating a proof) — they MUST stay in sync.

const { buildPoseidon } = require("circomlibjs");
const { ethers } = require("ethers");

// BN254 scalar field prime (same field circom/snarkjs work in).
const FIELD_SIZE = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

/// Deterministically map any UTF-8 password string to a field element.
function passwordToSecret(password) {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(password));
  return BigInt(hash) % FIELD_SIZE;
}

async function poseidonHash(inputs) {
  const poseidon = await buildPoseidon();
  const res = poseidon(inputs.map((x) => BigInt(x)));
  return poseidon.F.toObject(res);
}

async function passwordHashOf(password) {
  const secret = passwordToSecret(password);
  const hash = await poseidonHash([secret]);
  return { secret, passwordHash: hash };
}

module.exports = { passwordToSecret, poseidonHash, passwordHashOf, FIELD_SIZE };
