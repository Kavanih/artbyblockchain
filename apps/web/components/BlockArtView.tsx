"use client";

import { useState } from "react";
import type { LatexDoc, Params } from "@slotart/engine";
import { FormulaCanvas } from "./FormulaCanvas";
import { Formula } from "./Formula";
import { BlockSummary } from "@/lib/types";
import { MintPanel } from "./MintPanel";

function fmtTime(t: number | null) {
  return t ? new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "unknown";
}

export function BlockArtView({ block, params, doc }: { block: BlockSummary; params: Params; doc: LatexDoc }) {
  const [tab, setTab] = useState<"data" | "params" | "formula">("data");
  const rows: [string, React.ReactNode][] = [
    ["Slot", block.slot],
    ["Blockhash", <code key="h" className="break-all text-xs">{block.blockhash}</code>],
    ["Parent slot", block.parentSlot],
    ["Block height", block.blockHeight ?? "unknown"],
    ["Block time", fmtTime(block.blockTime)],
    ["Transactions", `${block.txCount} (${block.failedTxCount} failed)`],
    ["Total fees", `${block.totalFees} lamports (${(block.totalFees / 1e9).toFixed(6)} SOL)`],
    ["Compute units", block.computeUnits],
    ["Distinct programs", block.programIds.length],
    ["Layers derived", params.layers.length]
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="panel overflow-hidden">
          <FormulaCanvas params={params} width={768} height={768} />
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <a className="underline" href={`/api/render?slot=${block.slot}&size=1024`} target="_blank" rel="noreferrer">
            Canonical PNG (CPU render, 1024 px)
          </a>
          <a className="underline" href={`/api/block/${block.slot}`} target="_blank" rel="noreferrer">
            Block data and parameters as JSON
          </a>
        </div>
        <MintPanel kind="block" slot={block.slot} params={params} />
      </div>
      <div className="panel p-4">
        <div className="mb-3 flex gap-2 text-sm">
          {(["data", "params", "formula"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 ${tab === t ? "bg-[var(--accent)] text-black" : "border border-[var(--line)]"}`}
            >
              {t === "data" ? "Block data" : t === "params" ? "Parameters" : "Formula"}
            </button>
          ))}
        </div>
        {tab === "data" && (
          <div className="space-y-4 text-sm">
            <table className="w-full">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-b border-[var(--line)]">
                    <td className="py-1 pr-3 text-[var(--muted)]">{k}</td>
                    <td className="py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <div className="mb-1 text-[var(--muted)]">Program IDs ({block.programIds.length})</div>
              <div className="max-h-40 overflow-auto text-xs">
                {block.programIds.map((p) => (
                  <div key={p} className="font-mono">{p}</div>
                ))}
                {block.programIds.length === 0 && <div>none</div>}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[var(--muted)]">Signatures (first {Math.min(20, block.signatures.length)} of {block.signatures.length})</div>
              <div className="max-h-40 overflow-auto text-xs">
                {block.signatures.slice(0, 20).map((s) => (
                  <div key={s} className="truncate font-mono">{s}</div>
                ))}
                {block.signatures.length === 0 && <div>none</div>}
              </div>
            </div>
          </div>
        )}
        {tab === "params" && (
          <pre className="max-h-[70vh] overflow-auto text-xs" data-testid="params-json">
            {JSON.stringify(params, null, 2)}
          </pre>
        )}
        {tab === "formula" && (
          <div className="max-h-[70vh] overflow-auto" data-testid="formula">
            <Formula doc={doc} />
          </div>
        )}
      </div>
    </div>
  );
}
