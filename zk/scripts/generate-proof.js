// Generates a Groth16 proof that the caller holds a valid, unused one-time
// code (proving Merkle-tree membership) for a given buyer address. This is
// a CLI mirror of the proof generation the React frontend does in-browser
// with snarkjs, using the same code + Merkle path a buyer would receive
// from scripts/distribute-code.js after a (currently dummy) payment.
//
// Usage:
//   node scripts/generate-proof.js <buyerAddress> [path/to/code-bundle.json]
//
// If no bundle path is given, reads one from stdin (so you can pipe
// distribute-code.js straight into this script).

const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");

const WASM_PATH = path.join(__dirname, "../build/purchase_js/purchase.wasm");
const ZKEY_PATH = path.join(__dirname, "../build/purchase_final.zkey");
const TREE_PATH = path.join(__dirname, "../data/tree.json");

async function main() {
  const [buyerAddress, bundlePath] = process.argv.slice(2);
  if (!buyerAddress) {
    console.error("Usage: node scripts/generate-proof.js <buyerAddress> [path/to/code-bundle.json]");
    process.exit(1);
  }

  const bundleRaw = bundlePath
    ? fs.readFileSync(bundlePath, "utf8")
    : fs.readFileSync(0, "utf8"); // stdin
  const { code, pathElements, pathIndices } = JSON.parse(bundleRaw);

  const { root } = JSON.parse(fs.readFileSync(TREE_PATH, "utf8"));
  const buyer = BigInt(buyerAddress).toString();

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { code, pathElements, pathIndices, root, buyer },
    WASM_PATH,
    ZKEY_PATH
  );

  const callDataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const parsed = JSON.parse(`[${callDataStr}]`);

  console.log("Public signals [nullifier, root, buyer]:");
  console.log(publicSignals);
  console.log("\nCalldata for ZkNftMarketplace.purchase(pA, pB, pC, pubSignals):");
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
