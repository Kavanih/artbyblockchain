"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Params } from "@slotart/engine";
import { mintNetwork } from "@/lib/network";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

interface Props {
  kind: "block" | "custom";
  slot?: number;
  params: Params;
}

interface MintResult {
  id: string;
  assetAddress: string;
  txSignature: string;
  imageHash: string;
  network: string;
  dummy: boolean;
}

// Mint flow. Currently a dummy mint: the API records the claim in Postgres
// and returns placeholder addresses. The on-chain step is stubbed.
export function MintPanel({ kind, slot, params }: Props) {
  const { publicKey } = useWallet();
  const [state, setState] = useState<{ status: "idle" | "busy" | "done" | "error"; msg?: string; result?: MintResult }>({
    status: "idle"
  });
  const network = mintNetwork();
  const [claimed, setClaimed] = useState<{ owner: string } | null>(null);

  useEffect(() => {
    if (kind !== "block" || slot === undefined) return;
    fetch(`/api/mints?slot=${slot}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setClaimed(j?.claimed ? { owner: j.claim.owner } : null))
      .catch(() => setClaimed(null));
  }, [kind, slot, state.status]);

  async function mint() {
    if (!publicKey) return;
    setState({ status: "busy" });
    const res = await fetch("/api/mint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, slot, params, owner: publicKey.toBase58(), network })
    });
    const json = (await res.json()) as MintResult & { error?: string };
    if (!res.ok) setState({ status: "error", msg: json.error ?? `HTTP ${res.status}` });
    else setState({ status: "done", result: json });
  }

  return (
    <div className="panel space-y-3 p-4 text-sm" data-testid="mint-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">Mint as NFT</div>
          <div className="text-xs text-[var(--muted)]">
            Network: {network}. Dummy mint mode: the claim is recorded, no transaction is sent yet.
          </div>
        </div>
        <WalletMultiButton />
      </div>
      {kind === "block" && !claimed && (
        <div className="text-xs text-[var(--muted)]">One mint per slot. Slot {slot} can be claimed once.</div>
      )}
      {kind === "block" && claimed && (
        <div className="text-xs" data-testid="slot-claimed">
          Slot {slot} is already minted by <code>{claimed.owner}</code>.
        </div>
      )}
      <button
        onClick={mint}
        disabled={!publicKey || state.status === "busy" || !!claimed}
        className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-40"
        data-testid="mint-button"
      >
        {state.status === "busy" ? "Minting" : publicKey ? "Mint" : "Connect a wallet to mint"}
      </button>
      {state.status === "error" && <div className="text-red-400" data-testid="mint-error">{state.msg}</div>}
      {state.status === "done" && state.result && (
        <div className="space-y-1 text-xs" data-testid="mint-result">
          <div>Minted. Asset: <code>{state.result.assetAddress}</code></div>
          <div>Transaction: <code>{state.result.txSignature}</code></div>
          <div>Image hash: <code>{state.result.imageHash}</code></div>
        </div>
      )}
    </div>
  );
}
