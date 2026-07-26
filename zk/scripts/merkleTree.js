const { buildPoseidon } = require("circomlibjs");

/**
 * A fixed-depth, fully-populated binary Merkle tree over Poseidon hashes,
 * matching zk/circuits/merkleTree.circom exactly:
 *   - leaf hash:  Poseidon([code])            (1 input)
 *   - node hash:  Poseidon([left, right])     (2 inputs)
 *   - pathIndices[i] == 0  ->  current node is the LEFT child at level i
 *   - pathIndices[i] == 1  ->  current node is the RIGHT child at level i
 *
 * Requires leaves.length === 2 ** levels (no padding logic — this project
 * always provisions exactly a full tree of one-time codes).
 */
class MerkleTree {
  static async build(leaves, levels) {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    const capacity = 2 ** levels;
    if (leaves.length !== capacity) {
      throw new Error(`Expected exactly ${capacity} leaves for a depth-${levels} tree, got ${leaves.length}`);
    }

    const hash1 = (x) => F.toObject(poseidon([BigInt(x)]));
    const hash2 = (a, b) => F.toObject(poseidon([BigInt(a), BigInt(b)]));

    const layers = [leaves.map((code) => hash1(code))];
    for (let level = 0; level < levels; level++) {
      const prev = layers[level];
      const next = [];
      for (let i = 0; i < prev.length; i += 2) {
        next.push(hash2(prev[i], prev[i + 1]));
      }
      layers.push(next);
    }

    return new MerkleTree(layers, levels);
  }

  constructor(layers, levels) {
    this.layers = layers; // layers[0] = leaf hashes, layers[levels] = [root]
    this.levels = levels;
  }

  get root() {
    return this.layers[this.levels][0];
  }

  /** Returns { pathElements, pathIndices } for the leaf at `index`. */
  getProof(index) {
    const pathElements = [];
    const pathIndices = [];
    let idx = index;
    for (let level = 0; level < this.levels; level++) {
      const isRightChild = idx % 2 === 1;
      const siblingIdx = isRightChild ? idx - 1 : idx + 1;
      pathElements.push(this.layers[level][siblingIdx]);
      pathIndices.push(isRightChild ? 1 : 0);
      idx = Math.floor(idx / 2);
    }
    return { pathElements, pathIndices };
  }
}

module.exports = { MerkleTree };
