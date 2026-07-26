// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Verifier.sol";
import {ZkNftMarketplace} from "../src/ZkNftMarketplace.sol";

/// @notice Deploys the verifier + marketplace.
///
/// Required env vars:
///   PRIVATE_KEY  - deployer key
///   MERKLE_ROOT  - output of `node zk/scripts/generate-codes.js`
/// Optional env vars:
///   NFT_NAME     - default "ZK Gated NFT"
///   NFT_SYMBOL   - default "ZKNFT"
///   PRICE        - informational only, default 0
contract Deploy is Script {
    function run() external returns (address verifierAddr, address marketplaceAddr) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 merkleRoot = vm.envUint("MERKLE_ROOT");
        string memory name_ = vm.envOr("NFT_NAME", string("ZK Gated NFT"));
        string memory symbol_ = vm.envOr("NFT_SYMBOL", string("ZKNFT"));
        uint256 price_ = vm.envOr("PRICE", uint256(0));

        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        Groth16Verifier verifier = new Groth16Verifier();
        ZkNftMarketplace marketplace = new ZkNftMarketplace(
            name_,
            symbol_,
            address(verifier),
            merkleRoot,
            price_,
            deployer
        );

        vm.stopBroadcast();

        console.log("Groth16Verifier deployed at:", address(verifier));
        console.log("ZkNftMarketplace deployed at:", address(marketplace));

        return (address(verifier), address(marketplace));
    }
}
