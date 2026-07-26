const fs = require("fs");
const snarkjs = require("snarkjs");
const path = require("path");

async function main() {
  const bundle = JSON.parse(fs.readFileSync("/tmp/bundle_clean.json", "utf8"));
  const { root } = JSON.parse(fs.readFileSync(path.join(__dirname, "data/tree.json"), "utf8"));
  const buyer = BigInt("0x702ab18ef7a539ac096f0bd6ff936f779f4a8f9c").toString();

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { code: bundle.code, pathElements: bundle.pathElements, pathIndices: bundle.pathIndices, root, buyer },
    "build/purchase_js/purchase.wasm",
    "build/purchase_final.zkey"
  );
  fs.writeFileSync("/tmp/proof.json", JSON.stringify(proof));
  fs.writeFileSync("/tmp/public.json", JSON.stringify(publicSignals));
  console.log("done");
}
main().catch(e => { console.error(e); process.exit(1); });
