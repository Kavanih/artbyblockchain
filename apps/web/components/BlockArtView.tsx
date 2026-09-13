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
    ["Slot", <span key="s" className="tabular">{block.slot}</span>],
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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="hero-frame panel-soft overflow-hidden">
          <FormulaCanvas params={params} width={768} height={768} className="block w-full" />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <a className="text-[var(--accent)] underline-offset-2 hover:underline" href={`/api/render?slot=${block.slot}&size=512`} target="_blank" rel="noreferrer">
            Canonical PNG (CPU render, 512 px)
          </a>
          <a className="text-[var(--accent)] underline-offset-2 hover:underline" href={`/api/block/${block.slot}`} target="_blank" rel="noreferrer">
            Block data and parameters as JSON
          </a>
        </div>
        <MintPanel kind="block" slot={block.slot} params={params} />
      </div>

      <div className="panel p-5">
        <div className="mb-4 flex gap-1 border-b border-[var(--line-soft)]">
          {(["data", "params", "formula"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-2 text-sm transition-colors ${
                tab === t ? "text-[var(--accent-ink)]" : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {t === "data" ? "Block data" : t === "params" ? "Parameters" : "Formula"}
              {tab === t && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--accent)]" />}
            </button>
          ))}
        </div>

        {tab === "data" && (
          <div className="space-y-5 text-sm">
            <table className="w-full">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-b border-[var(--line-soft)]">
                    <td className="py-1.5 pr-4 text-[var(--muted)]">{k}</td>
                    <td className="py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--faint)]">
                Program IDs ({block.programIds.length})
              </div>
              <div className="max-h-40 overflow-auto rounded-md bg-[var(--panel-soft)] p-2 text-xs">
                {block.programIds.map((p) => (
                  <div key={p} className="truncate mono">{p}</div>
                ))}
                {block.programIds.length === 0 && <div className="text-[var(--faint)]">none</div>}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--faint)]">
                Signatures (first {Math.min(20, block.signatures.length)} of {block.signatures.length})
              </div>
              <div className="max-h-40 overflow-auto rounded-md bg-[var(--panel-soft)] p-2 text-xs">
                {block.signatures.slice(0, 20).map((s) => (
                  <div key={s} className="truncate mono">{s}</div>
                ))}
                {block.signatures.length === 0 && <div className="text-[var(--faint)]">none</div>}
              </div>
            </div>
          </div>
        )}
        {tab === "params" && (
          <pre className="max-h-[70vh] overflow-auto rounded-md bg-[var(--panel-soft)] p-3 text-xs" data-testid="params-json">
            {JSON.stringify(params, null, 2)}
          </pre>
        )}
        {tab === "formula" && (
          <div className="max-h-[70vh] overflow-auto pr-1" data-testid="formula">
            <Formula doc={doc} />
          </div>
        )}
      </div>
    </div>
  );
}