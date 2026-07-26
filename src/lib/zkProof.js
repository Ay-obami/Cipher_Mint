import * as snarkjs from "snarkjs";

const WASM_URL = "/circuit/purchase.wasm";
const ZKEY_URL = "/circuit/purchase_final.zkey";

/**
 * Generates a Groth16 proof that the caller holds a valid, unused one-time
 * code belonging to the deployer's Merkle tree, for a given buyer address.
 * `codeBundle` is exactly what zk/scripts/distribute-code.js hands out:
 * { code, pathElements, pathIndices }.
 *
 * Returns calldata ready to pass into
 * ZkNftMarketplace.purchase(pA, pB, pC, pubSignals).
 */
export async function generatePurchaseProof({ codeBundle, root, buyerAddress }) {
  const { code, pathElements, pathIndices } = codeBundle;
  const buyer = BigInt(buyerAddress).toString();

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { code, pathElements, pathIndices, root, buyer },
    WASM_URL,
    ZKEY_URL
  );

  const callDataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC, pubSignals4] = JSON.parse(`[${callDataStr}]`);

  return {
    pA,
    pB,
    pC,
    pubSignals: pubSignals4, // [nullifier, root, buyer]
    raw: { proof, publicSignals },
  };
}
