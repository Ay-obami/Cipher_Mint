// Deployer-side "fulfil one sale" script. Run after a buyer's (currently
// dummy) payment succeeds. Picks the next unused code from the inventory,
// marks it used, and prints everything the buyer's frontend needs to
// generate their proof.
//
// Usage:
//   node scripts/distribute-code.js

const fs = require("fs");
const path = require("path");
const { MerkleTree } = require("./merkleTree");

const dataDir = path.join(__dirname, "../data");
const codesPath = path.join(dataDir, "codes.json");
const treePath = path.join(dataDir, "tree.json");

function main() {
  if (!fs.existsSync(codesPath) || !fs.existsSync(treePath)) {
    console.error("No code inventory found. Run `node scripts/generate-codes.js` first.");
    process.exit(1);
  }

  const codes = JSON.parse(fs.readFileSync(codesPath, "utf8"));
  const treeData = JSON.parse(fs.readFileSync(treePath, "utf8"));

  const next = codes.find((c) => !c.used);
  if (!next) {
    console.error("All codes have been distributed — provision a new batch.");
    process.exit(1);
  }

  const tree = new MerkleTree(
    treeData.layers.map((layer) => layer.map((v) => BigInt(v))),
    treeData.levels
  );
  const { pathElements, pathIndices } = tree.getProof(next.index);

  next.used = true;
  fs.writeFileSync(codesPath, JSON.stringify(codes));

  const bundle = {
    code: next.code,
    index: next.index,
    pathElements: pathElements.map((v) => v.toString()),
    pathIndices,
  };

  console.log("Hand this to the buyer (e.g. on the post-payment receipt page):\n");
  console.log(JSON.stringify(bundle, null, 2));
}

main();
