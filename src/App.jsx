import { useState, useCallback } from "react";
import { ethers } from "ethers";
import "./index.css";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, EXPECTED_CHAIN_ID_HEX, MERKLE_ROOT } from "./config";
import { generatePurchaseProof } from "./lib/zkProof";
import demoCodeBundle from "./demoCodeBundle.json";

function short(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [paid, setPaid] = useState(false);
  const [codeBundle, setCodeBundle] = useState(null);
  const [proofState, setProofState] = useState("idle"); // idle | proving | minting | done | error
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("No wallet found. Install MetaMask (or similar) to continue.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      setError("");
    } catch (e) {
      setError(e.shortMessage || e.message);
    }
  }, []);

  const dummyPay = useCallback(() => {
    // Stand-in for a real payment step (card, bank transfer, whatever). In
    // a real deployment, your payment webhook would call the equivalent of
    // `zk/scripts/distribute-code.js` server-side and hand the buyer back
    // exactly one unused code + its Merkle path — never the same one twice.
    // This demo just ships one fixed bundle for illustration.
    setPaid(true);
    setCodeBundle(demoCodeBundle);
  }, []);

  const proveAndMint = useCallback(async () => {
    if (!account || !codeBundle) return;
    setError("");
    try {
      setProofState("proving");
      const { pA, pB, pC, pubSignals } = await generatePurchaseProof({
        codeBundle,
        root: MERKLE_ROOT,
        buyerAddress: account,
      });

      setProofState("minting");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if ("0x" + network.chainId.toString(16) !== EXPECTED_CHAIN_ID_HEX) {
        throw new Error(
          `Wrong network — expected chain ${EXPECTED_CHAIN_ID_HEX}, wallet is on 0x${network.chainId.toString(16)}`
        );
      }
      if (!MARKETPLACE_ADDRESS) {
        throw new Error("Set VITE_MARKETPLACE_ADDRESS in .env to the deployed contract address.");
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
      const tx = await contract.purchase(pA, pB, pC, pubSignals);
      const rcpt = await tx.wait();

      const event = rcpt.logs
        .map((l) => {
          try {
            return contract.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((l) => l && l.name === "Purchased");

      setReceipt({
        txHash: rcpt.hash,
        tokenId: event ? event.args.tokenId.toString() : "?",
        nullifier: pubSignals[0],
      });
      setProofState("done");
    } catch (e) {
      setError(e.shortMessage || e.message || String(e));
      setProofState("error");
    }
  }, [account, codeBundle]);

  const step1Done = Boolean(account);
  const step2Done = paid;
  const step3Done = proofState === "done";

  return (
    <div className="shell">
      <div className="masthead">
        <h1>
          zk<span>·</span>marketplace
        </h1>
        {account ? (
          <span className="wallet-chip connected">{short(account)}</span>
        ) : (
          <span className="wallet-chip">not connected</span>
        )}
      </div>
      <p className="tagline">
        Mint is gated by a zero-knowledge proof that you hold one of a fixed batch of one-time codes — not by the
        payment itself. Pay any way you like off-chain; the contract only ever sees a proof and a nullifier, never
        the code.
      </p>

      <div className="ledger">
        <div className={`step ${step1Done ? "done" : "active"}`}>
          <div className="step-index">01</div>
          <div className="step-body">
            <h2>Connect wallet</h2>
            <p>The address you connect is bound into the proof, so it can't be intercepted and reused by anyone else.</p>
            {!account && (
              <button className="btn btn-primary" onClick={connect}>
                Connect wallet
              </button>
            )}
          </div>
        </div>

        <div className={`step ${!step1Done ? "pending" : step2Done ? "done" : "active"}`}>
          <div className="step-index">02</div>
          <div className="step-body">
            <h2>Pay (dummy)</h2>
            <p>
              Stand-in for a real payment step. On success you're handed exactly one unused code and its Merkle
              proof — each code can back exactly one mint, ever.
            </p>
            {step1Done && !paid && (
              <button className="btn" onClick={dummyPay}>
                Simulate payment
              </button>
            )}
            {paid && <div className="mono-value">code: {codeBundle.code}</div>}
          </div>
        </div>

        <div className={`step ${!step2Done ? "pending" : step3Done ? "done" : "active"}`}>
          <div className="step-index">03</div>
          <div className="step-body">
            <h2>Prove &amp; mint</h2>
            <p>
              Generates a Groth16 proof in your browser that your code belongs to the deployer's committed batch,
              without revealing which one, then submits it on-chain to mint.
            </p>
            {step2Done && proofState !== "done" && (
              <button
                className="btn btn-primary"
                onClick={proveAndMint}
                disabled={proofState === "proving" || proofState === "minting"}
              >
                {proofState === "proving" && "Generating proof…"}
                {proofState === "minting" && "Waiting for transaction…"}
                {(proofState === "idle" || proofState === "error") && "Generate proof & mint"}
              </button>
            )}
            {error && <div className="status-line err">{error}</div>}
          </div>
        </div>
      </div>

      {receipt && (
        <div className="receipt">
          <h3>Mint receipt</h3>
          <div className="receipt-row">
            <span className="label">token id</span>
            <span className="value">{receipt.tokenId}</span>
          </div>
          <div className="receipt-row">
            <span className="label">nullifier</span>
            <span className="value">{receipt.nullifier}</span>
          </div>
          <div className="receipt-row">
            <span className="label">tx hash</span>
            <span className="value">{receipt.txHash}</span>
          </div>
        </div>
      )}

      <div className="footnote">
        Your code never leaves your browser — only a nullifier derived from it (and a Merkle-membership proof) is
        revealed on-chain. Each code produces exactly one valid nullifier, so it can mint at most once no matter who
        holds it or how many times someone tries. Buyer address is cryptographically bound into the proof itself, so
        an observed transaction can't be intercepted and reused under a different address.
      </div>
    </div>
  );
}
