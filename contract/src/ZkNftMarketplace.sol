// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Groth16Verifier} from "./Verifier.sol";

/// @title ZK-Gated NFT Marketplace (one-time-code / Merkle version)
/// @notice Payment happens off-chain (for now, dummy). At setup, the deployer
///         provisions a fixed batch of one-time codes and commits to them as
///         a Poseidon Merkle tree (`root`). After a buyer pays, they're handed
///         exactly one unused code + its Merkle path. To mint, they submit a
///         Groth16 proof that they know a code belonging to that tree —
///         without revealing which one.
///
///         The nullifier is derived from the code ALONE (never from the
///         buyer address), so a given code can produce exactly one valid,
///         unused nullifier ever — no matter who submits it or how many
///         times someone tries. This is what actually prevents unlimited
///         self-minting: knowing a code lets you use it once, not forever.
///
///         `buyer` is still a public input, and the circuit binds it into a
///         real constraint (`buyerSquare <== buyer * buyer`) so a valid
///         proof can't be intercepted and resubmitted under someone else's
///         address — the contract additionally requires msg.sender to match
///         the address the proof was generated for.
contract ZkNftMarketplace is ERC721, Ownable {
    Groth16Verifier public immutable verifier;

    /// @notice Root of the Poseidon Merkle tree over all one-time codes
    ///         provisioned at setup (see zk/scripts/generate-codes.js).
    ///         No individual code is ever stored on-chain.
    uint256 public immutable root;

    /// @notice price is informational only right now — payment is off-chain
    ///         (bank transfer, card, whatever) and is NOT enforced by this
    ///         contract. It exists so the frontend/event log can display it.
    uint256 public price;

    uint256 public nextTokenId;

    mapping(uint256 => bool) public nullifierUsed;

    event Purchased(address indexed buyer, uint256 indexed tokenId, uint256 nullifier);
    event PriceUpdated(uint256 newPrice);

    error InvalidProof();
    error RootMismatch();
    error NullifierAlreadyUsed();
    error BuyerMismatch();

    constructor(
        string memory name_,
        string memory symbol_,
        address verifierAddress,
        uint256 root_,
        uint256 price_,
        address initialOwner
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        verifier = Groth16Verifier(verifierAddress);
        root = root_;
        price = price_;
    }

    /// @notice Mint an NFT by proving knowledge of an unused one-time code.
    /// @param pA Groth16 proof component A
    /// @param pB Groth16 proof component B
    /// @param pC Groth16 proof component C
    /// @param pubSignals Public signals in the exact order the circuit
    ///        emits them: [nullifier, root, buyer]
    function purchase(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[3] calldata pubSignals
    ) external returns (uint256 tokenId) {
        uint256 nullifier = pubSignals[0];
        uint256 provenRoot = pubSignals[1];
        uint256 buyer = pubSignals[2];

        if (provenRoot != root) revert RootMismatch();
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();
        // Binds the proof to the caller so a proof seen on-chain (or
        // leaked/observed) can't be resubmitted by someone else. This only
        // works BECAUSE the circuit forces `buyer` into a real constraint
        // (buyerSquare) -- otherwise this check would be trivially
        // bypassable by just relabeling the public signal.
        if (buyer != uint256(uint160(msg.sender))) revert BuyerMismatch();
        if (!verifier.verifyProof(pA, pB, pC, pubSignals)) revert InvalidProof();

        nullifierUsed[nullifier] = true;

        tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);

        emit Purchased(msg.sender, tokenId, nullifier);
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
        emit PriceUpdated(newPrice);
    }
}
