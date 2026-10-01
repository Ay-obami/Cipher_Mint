# Cipher Mint Portfolio Checklist

Status: **READY FOR REVIEW**  
Repository base: `33c59f0`

## Reproduce the verified contract path

From the repository root:

```bash
CONTRACT_ROOT="$PWD/contract"
forge install --root "$CONTRACT_ROOT" --no-git --shallow OpenZeppelin/openzeppelin-contracts@v5.3.0
forge install --root "$CONTRACT_ROOT" --no-git --shallow foundry-rs/forge-std@v1.9.7

cd contract
forge test -vv
```

Fresh 2026-10-01 verification:

- Foundry: 1.5.1-stable.
- Solidity compiler: 0.8.28.
- OpenZeppelin Contracts: 5.3.0.
- forge-std: 1.9.7.
- Foundry suite: **6 passed, 0 failed, 0 skipped**.

## What the case study demonstrates

Cipher Mint uses a real Groth16 proof to gate NFT minting behind knowledge of a one-time code committed in a Poseidon Merkle tree. The contract consumes a per-code nullifier and binds the proof to the buyer address.

The fresh Foundry suite verifies:

1. the generated verifier accepts the real proof fixture;
2. a valid proof mints to the proven buyer;
3. the same nullifier cannot be replayed;
4. a different caller cannot use the proof;
5. changing the public buyer signal invalidates proof verification;
6. changing the committed Merkle root fails.

## Safe claims

- The on-chain path uses a real Groth16 proof fixture, not a verifier mock.
- Code reuse is prevented on-chain by the consumed nullifier.
- The buyer public signal is constrained by the circuit and checked against `msg.sender`.
- The tested contract build uses solc 0.8.28 with pinned OpenZeppelin 5.3.0 and forge-std 1.9.7 dependencies.
- The repository documents the trusted-setup and payment-layer limits explicitly.

## Do not claim

- Do not claim a production payment-provider integration.
- Do not claim payment webhooks are authenticated or idempotent.
- Do not claim the JSON code allocator is concurrency-safe or transactional.
- Do not claim the included single-contributor trusted setup is production-grade.
- Do not claim the historical Anvil/frontend run was freshly repeated in this portfolio-readiness pass.

## Parked / residual items

- **PARKED:** payment-provider integration.
- **REQUIRED FOR PRODUCTION:** signed provider-event verification, durable order state, provider-event/order idempotency, and atomic code reservation/delivery.
- **REQUIRED FOR PRODUCTION:** replace the toy trusted setup with a suitable multi-party ceremony or trusted published parameters.
- **DEMO-ONLY DATA:** `zk/data/codes.json` and `zk/data/tree.json` are committed for demonstration and must not be public inventory in a real deployment.
- **CI:** no tracked GitHub Actions workflow currently runs the Foundry suite; fresh local output is the applicable verification evidence.

## Evidence map

- `contract/test/ZkNftMarketplace.t.sol` — six proof-path regression tests.
- `zk/scripts/generate-proof.js` — proof fixture generation path.
- `zk/scripts/distribute-code.js` — demo-only code allocator.
- `contract/src/ZkNftMarketplace.sol` — on-chain proof/root/nullifier/buyer enforcement.
- `README.md` — architecture, reproducible setup, and product limits.
- `contract/README.md` — pinned Foundry dependencies and contract-specific verification commands.

## Release verification

Contract/proof regression verification: **DONE**.  
Payment integration: **PARKED**.  
Production trusted setup: **PARKED**.
