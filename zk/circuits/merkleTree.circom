pragma circom 2.2.3;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Proves that `leaf` is a member of the tree committed to by `root`,
// given a private authentication path (`pathElements`, `pathIndices`).
// pathIndices[i] == 0 means the current node is the LEFT child at that
// level (sibling goes on the right); 1 means the opposite.
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    component hashers[levels];
    signal left[levels];
    signal right[levels];

    for (var i = 0; i < levels; i++) {
        // pathIndices[i] must be boolean.
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Select (left, right) = (current, sibling) or (sibling, current)
        // depending on pathIndices[i], without branching (circuits can't
        // branch on a signal at compile time).
        left[i] <== levelHashes[i] + pathIndices[i] * (pathElements[i] - levelHashes[i]);
        right[i] <== pathElements[i] + pathIndices[i] * (levelHashes[i] - pathElements[i]);

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        levelHashes[i + 1] <== hashers[i].out;
    }

    root === levelHashes[levels];
}
