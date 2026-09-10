import Link from "next/link";
import { prisma } from "@/lib/db";
import { FormulaCanvas } from "@/components/FormulaCanvas";
import type { Params } from "@slotart/engine";

export const dynamic = "force-dynamic";

export default async function MintsPage() {
  let mints: Awaited<ReturnType<typeof prisma.mint.findMany<{ include: { claim: true } }>>> = [];
  let error: string | null = null;
  try {
    mints = await prisma.mint.findMany({ orderBy: { createdAt: "desc" }, take: 48, include: { claim: true } });
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mints</h1>
      <p className="text-[var(--muted)]">Recorded mints. Dummy mints have no on-chain asset yet.</p>
      {error && <p className="text-red-400">Database unavailable: {error}</p>}
      {!error && mints.length === 0 && <p data-testid="no-mints">Nothing minted yet.</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="mints-grid">
        {mints.map((m) => {
          const params = m.params as unknown as Params;
          const slot = m.claim ? Number(m.claim.slot) : null;
          return (
            <div key={m.id} className="panel overflow-hidden">
              {slot !== null ? (
                <Link href={`/block?slot=${slot}`}>
                  <FormulaCanvas params={params} width={256} height={256} />
                </Link>
              ) : (
                <FormulaCanvas params={params} width={256} height={256} />
              )}
              <div className="space-y-1 px-3 py-2 text-xs">
                <div className="font-medium">{slot !== null ? `Slot ${slot}` : params.title ?? "Custom"}</div>
                <div className="text-[var(--muted)]">
                  {m.network}, {m.status}
                </div>
                <div className="truncate font-mono text-[var(--muted)]" title={m.owner}>
                  {m.owner}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
