# ZkNftMarketplace contract

This directory is the Foundry project for Cipher Mint's ZK-gated ERC-721 marketplace. The contract verifies a real Groth16 proof, rejects nullifier replay, requires the proven buyer to equal the caller, and mints only after proof verification succeeds.

## Toolchain

- Foundry: tested with forge 1.5.1-stable
- Solidity compiler: 0.8.28 (pinned in `foundry.toml`)
- OpenZeppelin Contracts: 5.3.0
- forge-std: 1.9.7

The parent Git repository does not track Foundry submodule definitions, and `contract/lib/*` is gitignored. Install the exact dependencies from the repository root with:

```bash
CONTRACT_ROOT="$PWD/contract"
forge install --root "$CONTRACT_ROOT" --no-git --shallow OpenZeppelin/openzeppelin-contracts@v5.3.0
forge install --root "$CONTRACT_ROOT" --no-git --shallow foundry-rs/forge-std@v1.9.7
```

Using an absolute `--root` is intentional because this Foundry project is nested inside the parent Git repository.
## Build and test

```bash
cd contract
forge build
forge test -vv
```

The current suite contains six tests and uses a real Groth16 proof fixture:

- raw verifier accepts the generated proof;
- valid purchase mints and consumes the nullifier;
- nullifier replay reverts;
- a caller different from the proven buyer reverts;
- changing the public buyer signal invalidates the proof;
- changing the Merkle root reverts.

Fresh portfolio-readiness verification on 2026-10-01: **6 passed, 0 failed, 0 skipped**.

## Contract boundary

The contract verifies proof/root/nullifier/buyer conditions. It does **not** verify an off-chain payment. `price` is informational only.

Payment-provider verification, webhook idempotency, durable sale/allocation records, and transactional code reservation belong in a server-side fulfilment layer and are currently **PARKED**. See the root README and `../docs/portfolio-checklist.md`.
## Local deployment

Start Anvil in one terminal:

```bash
anvil
```

Then configure `contract/.env` from the example and deploy:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

The repository currently has no tracked CI workflow for this Foundry project, so local test output is the applicable fresh verification evidence.
