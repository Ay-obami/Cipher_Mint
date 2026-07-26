// Deployer-side setup script. Run ONCE per drop/batch.
//
// Usage:
//   node scripts/generate-codes.js [levels]
//
// Generates 2^levels random one-time codes (default levels=16 -> 65536
// codes), builds the Poseidon Merkle tree over them, and writes:
//   data/codes.json  - [{ index, code, used }, ...]   (the code inventory)
//   data/tree.json    - { levels, root, layers }        (full tree, for fast proof lookup)
//
// The printed `root` is what you pass to the contract constructor.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MerkleTree } = require("./merkleTree");

const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function randomFieldElement() {
  // Rejection sampling to avoid modulo bias.
  let value;
  do {
    const bytes = crypto.randomBytes(32);
    value = BigInt("0x" + bytes.toString("hex"));
  } while (value >= FIELD_SIZE * (2n ** 256n / FIELD_SIZE));
  return value % FIELD_SIZE;
}

async function main() {
  const levels = parseInt(process.argv[2] || "16", 10);
  const capacity = 2 ** levels;

  console.log(`Generating ${capacity} one-time codes (depth ${levels})...`);

  const codes = Array.from({ length: capacity }, () => randomFieldElement().toString());

  console.log("Building Merkle tree (this hashes every leaf and every internal node)...");
  const tree = await MerkleTree.build(codes, levels);

  const dataDir = path.join(__dirname, "../data");
  fs.mkdirSync(dataDir, { recursive: true });

  const codesRecords = codes.map((code, index) => ({ index, code, used: false }));
  fs.writeFileSync(path.join(dataDir, "codes.json"), JSON.stringify(codesRecords));

  const layersAsStrings = tree.layers.map((layer) => layer.map((v) => v.toString()));
  fs.writeFileSync(
    path.join(dataDir, "tree.json"),
    JSON.stringify({ levels, root: tree.root.toString(), layers: layersAsStrings })
  );

  console.log("\nWrote data/codes.json and data/tree.json");
  console.log("\nMerkle root (pass this to the contract constructor's `root_` argument):");
  console.log(tree.root.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
