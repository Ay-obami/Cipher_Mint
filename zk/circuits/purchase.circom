pragma circom 2.2.3;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "./merkleTree.circom";

// Proves knowledge of a one-time `code` whose commitment (leaf) belongs to
// the Merkle tree of codes the deployer generated at setup time, without
// revealing which code (or which leaf index) it is.
//
// Each code is single-use: the circuit derives `nullifier` from the code
// ALONE (never from `buyer`). This is deliberate -- if the nullifier
// depended on `buyer` too, the same leaked code could be re-proven under a
// different address and mint again. Tying it to the code only means one
// code can ever produce exactly one valid, unused nullifier, full stop.
//
// `buyer` is a public input that must still be cryptographically bound
// into the proof, or it becomes swappable: Groth16 verification only
// fails on a modified public input if that input actually appears in some
// constraint (i.e. its column in the constraint system is non-zero). A
// public signal that's merely *declared* but never multiplied into
// anything can be changed to any other value after the fact without
// invalidating the proof -- letting someone intercept a valid proof and
// resubmit it claiming to be a different buyer. The `buyerSquare`
// constraint below exists purely to close that hole (the standard trick,
// also used by Tornado Cash for its `recipient` input).
//
// Public signals (circom emits outputs before public inputs, in
// declaration order): [nullifier, root, buyer]
template Purchase(levels) {
    // Private inputs: the one-time code and its Merkle authentication path.
    signal input code;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Public inputs
    signal input root;   // Merkle root committed on-chain at deploy
    signal input buyer;  // msg.sender, as a field element

    // Public output
    signal output nullifier;

    // Forces `buyer` into a real (quadratic) constraint so it can't be
    // swapped post-proof-generation. The result is otherwise unused.
    signal buyerSquare;
    buyerSquare <== buyer * buyer;

    component leafHasher = Poseidon(1);
    leafHasher.inputs[0] <== code;

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== leafHasher.out;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Domain-separated from the leaf hash (different Poseidon arity, plus
    // an explicit constant input) so a nullifier can't be linked back to
    // the leaf/commitment it was derived from.
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== code;
    nullifierHasher.inputs[1] <== 1;
    nullifier <== nullifierHasher.out;
}

component main { public [root, buyer] } = Purchase(16);
