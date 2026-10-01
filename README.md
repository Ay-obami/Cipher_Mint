# Cipher Mint

An NFT marketplace where minting is gated by a zero-knowledge proof of
holding a **one-time purchase code**, instead of an on-chain payment. Payment
happens off-chain (currently a dummy stand-in — swap in Stripe, a bank
transfer confirmation, whatever, later). At setup, the deployer provisions a
fixed batch of one-time codes and commits to them as a Merkle root. After a
buyer pays, they're handed exactly one unused code + its Merkle proof. To
mint, they prove — in their browser, without revealing which code — that it
belongs to the committed batch, and the proof is bound to their address so
it can't be intercepted or replayed by someone else.

## Design history / why it looks like this

This started as a simpler "shared password" design (prove knowledge of one
password everyone gets after paying). That design has a real flaw: knowledge
of a password is *not consumable* — once a buyer learns it, they can
generate unlimited further proofs and mint for free, forever. The fix is
this repo's actual design: **one unique, single-use code per sale**, whose
nullifier depends only on the code itself. A code can produce exactly one
valid, unused nullifier, ever — knowing it lets you mint once, not forever.

A second, subtler bug is also fixed here: a public circuit signal (like
`buyer`) that isn't tied into any actual constraint is **swappable** after a
proof is generated — Groth16 verification only fails on a modified public
input if that input's column in the constraint system is non-zero. Without
binding, someone could intercept a valid pending transaction and resubmit it
claiming to be a different buyer, stealing the mint. This circuit forces
`buyer` into a real constraint (`buyerSquare <== buyer * buyer` — the same
trick Tornado Cash uses for its `recipient` input) specifically to close
that hole.

## How the proof works

**Circuit** (`zk/circuits/purchase.circom`, depth-16 Poseidon Merkle tree,
65,536-code capacity):

- private inputs: `code` (the one-time code), `pathElements[16]`,
  `pathIndices[16]` (the code's Merkle authentication path)
- public inputs: `root` (the tree root committed at deploy), `buyer`
  (address, bound via a dummy quadratic constraint so it can't be swapped)
- public output: `nullifier = Poseidon(code, 1)` — derived from the code
  *alone*, domain-separated from the leaf hash `Poseidon(code)`

**Contract** (`contract/src/ZkNftMarketplace.sol`):

1. Checks the proven `root` matches the one set at deploy time.
2. Checks the `nullifier` hasn't been used before.
3. Checks `buyer == msg.sender` — this only actually works *because* the
   circuit binds `buyer` into a real constraint; otherwise it'd be
   trivially bypassable by relabeling the public signal.
4. Verifies the Groth16 proof via the generated `Groth16Verifier`.
5. Marks the nullifier used, mints.

## Folder structure

```
zk-nft-marketplace/       React app (Vite) — root is the node-initialized project
├── src/                  frontend source
├── public/circuit/       purchase.wasm + purchase_final.zkey (served to the browser)
├── contract/             Foundry project
│   ├── src/               ZkNftMarketplace.sol, Verifier.sol (generated)
│   ├── script/Deploy.s.sol
│   └── test/               forge tests, using a real generated proof as fixture
└── zk/                   circom circuit + trusted setup + JS helper scripts
    ├── circuits/           purchase.circom, merkleTree.circom
    ├── scripts/            code generation, distribution, and proof generation
    ├── data/               codes.json (inventory), tree.json (full Merkle tree) — generated
    └── build/              compiled circuit, zkey, verification key — generated
```

## Setup

### 1. Install dependencies

```bash
npm install                 # root (React app)
cd zk && npm install && cd ..

# Foundry project is nested under this Git repo, so use an absolute project root.
CONTRACT_ROOT="$PWD/contract"
forge install --root "$CONTRACT_ROOT" --no-git --shallow OpenZeppelin/openzeppelin-contracts@v5.3.0
forge install --root "$CONTRACT_ROOT" --no-git --shallow foundry-rs/forge-std@v1.9.7
```

### 2. Circuit + trusted setup

This repo ships with compiled circuit artifacts and a completed (toy)
trusted setup already in `zk/build/`, plus a matching
`contract/src/Verifier.sol` and a provisioned code batch in `zk/data/`, so
you can skip straight to step 4. To rebuild from scratch (e.g. after editing
the circuit), run each stage **individually and verify before moving to the
next** — chaining these into one long command risks a step getting silently
cut short in resource-constrained environments, producing a corrupt file
that looks plausible but makes later steps hang or fail:

```bash
cd zk
npm run compile

npm run setup:ptau:new
npm run setup:ptau:contribute
npm run setup:ptau:prepare
npm run setup:ptau:verify        # must print "Powers of Tau Ok!" with NO
                                  # "does not contain phase2" warning

npm run setup:zkey:new
npm run setup:zkey:contribute
npm run setup:zkey:verify        # must print "ZKey Ok!"

npm run setup:export             # writes verification_key.json + Verifier.sol
npm run publish:frontend         # copies wasm + zkey into ../public/circuit/
```

> **This ceremony is for development only.** It uses a single, non-random
> contribution. For anything beyond local testing, run a real multi-party
> powers-of-tau ceremony (or reuse a published one, e.g. from the
> Hermez/Perpetual Powers of Tau project) sized for your circuit.

### 3. Provision a batch of one-time codes

```bash
cd zk
node scripts/generate-codes.js 16   # 2^16 = 65,536 codes
```

Writes `data/codes.json` (the inventory) and `data/tree.json` (the full
tree), and prints the Merkle **root** — pass this to the contract
constructor.

### 4. Deploy the contracts

```bash
# terminal 1
anvil

# terminal 2
cd contract
cp .env.example .env   # fill in MERKLE_ROOT from step 3
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast
```

Note the printed `ZkNftMarketplace deployed at:` address.

To target a testnet later, uncomment the `sepolia` line in
`contract/foundry.toml`, set `SEPOLIA_RPC_URL`, and pass
`--rpc-url sepolia --verify` (with `ETHERSCAN_API_KEY` set) instead.

### 5. Fulfil a sale (hand a buyer their code)

After a buyer's (currently dummy) payment succeeds:

```bash
cd zk
node scripts/distribute-code.js
```

For the demo, this picks the next unused code, marks it used in
`data/codes.json`, and prints a bundle `{ code, pathElements, pathIndices }`.
It is a local allocator, **not** a payment integration or production fulfilment
service. It does not verify a payment-provider webhook, persist an idempotency
key, lock the inventory, or reserve/deliver a code transactionally. Concurrent
or repeated executions can therefore allocate incorrectly.

A real integration must keep the inventory server-side, verify the provider's
signed success event, record a durable paid order, and atomically reserve
exactly one code for that order before returning the bundle. **Never distribute
the same code twice**, and never ship `data/codes.json` / `data/tree.json`
to the frontend — that would leak every code and defeat the whole point.

### 6. Configure and run the frontend

```bash
cp .env.example .env   # set VITE_MARKETPLACE_ADDRESS and VITE_MERKLE_ROOT
npm run dev
```

Connect a wallet pointed at the same chain (Anvil's default chain ID is
`31337` / `0x7a69`), click through Connect → Pay (dummy) → Generate proof &
mint.

> The demo frontend ships with one fixed code baked into
> `src/demoCodeBundle.json` (`dummyPay` just hands it out), standing in for
> what a real payment-success webhook would fetch server-side via
> `distribute-code.js`. It can only mint once per fresh contract deployment
> — regenerate a bundle for a different code if you need another test mint.

## Testing

```bash
cd contract
forge test -vv
```

The test suite uses **real** proofs produced by the compiled circuit (see
the fixture comments in `test/ZkNftMarketplace.t.sol` and
`zk/scripts/generate-proof.js` to regenerate one for different inputs), so
it's exercising the actual Groth16 verification path on-chain — not a mock.
It also includes `test_RevertsIfAttackerSwapsBuyerSignal`, which directly
proves the buyer-binding fix works: relabeling a valid proof's `buyer`
signal to a different address causes proof verification itself to fail.

A local Anvil end-to-end run was reported during the original development
work. The current portfolio-readiness pass freshly re-ran the six Foundry tests
above against the real proof fixture; it does not present the historical Anvil
run as fresh release evidence.

For the exact reproducible evidence, safe claims, and parked production work,
see `docs/portfolio-checklist.md`.

## Notes / things to change before this is a real product

- The dummy payment step (`dummyPay` in `src/App.jsx`) just hands out a
  hardcoded code client-side. **Payment integration is PARKED.** A real server
  must verify signed provider events, use provider-event/order idempotency,
  store sale and allocation state durably, and reserve/deliver codes under a
  database transaction or equivalent lock. The current `distribute-code.js`
  JSON read-modify-write flow provides none of those guarantees.
- The repository does not currently track a CI workflow for the Foundry suite;
  the fresh local `forge test -vv` result is the current verification evidence.
- The trusted setup shipped here is a toy, single-contributor ceremony —
  replace before any real deployment.
- `price` on the contract is informational only; it isn't enforced, since
  payment isn't on-chain.
- This design has a fixed supply (65,536 codes, decided at setup). For an
  open-ended/unlimited supply instead, the alternative is dropping the
  Merkle tree and having the contract owner add one new code commitment
  on-chain per sale (a single `addCommitment(hash)` owner-only tx) — more
  on-chain overhead per sale, but no upper bound on supply.
