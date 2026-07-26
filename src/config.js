// Fill these in after deploying with `forge script script/Deploy.s.sol`.
export const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";

// The chain the app expects the wallet to be on. Defaults to local Anvil.
export const EXPECTED_CHAIN_ID_HEX = import.meta.env.VITE_CHAIN_ID_HEX || "0x7a69"; // 31337

// Merkle root over the deployer's one-time-code batch, from
// zk/scripts/generate-codes.js. Must match what the contract was deployed
// with, since it's a required circuit input for proof generation.
export const MERKLE_ROOT = import.meta.env.VITE_MERKLE_ROOT || "";

export const MARKETPLACE_ABI = [
  "function purchase(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[3] pubSignals) returns (uint256)",
  "function root() view returns (uint256)",
  "function price() view returns (uint256)",
  "function nullifierUsed(uint256) view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "event Purchased(address indexed buyer, uint256 indexed tokenId, uint256 nullifier)",
];
