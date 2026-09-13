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
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">Ledger</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Mints</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Every recorded mint. Dummy mints have no on-chain asset yet; the claim is kept in Postgres.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Database unavailable: {error}
        </div>
      )}
      {!error && mints.length === 0 && <p data-testid="no-mints" className="text-sm text-[var(--muted)]">Nothing minted yet.</p>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="mints-grid">
        {mints.map((m) => {
          const params = m.params as unknown as Params;
          const slot = m.claim ? Number(m.claim.slot) : null;
          return (
            <div key={m.id} className="panel overflow-hidden">
              {slot !== null ? (
                <Link href={`/block?slot=${slot}`}>
                  <FormulaCanvas params={params} width={320} height={320} className="block w-full" />
                </Link>
              ) : (
                <FormulaCanvas params={params} width={320} height={320} className="block w-full" />
              )}
              <div className="space-y-1 px-4 py-3">
                <div className="font-serif text-lg font-medium tabular">
                  {slot !== null ? `Slot ${slot}` : params.title ?? "Custom"}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {m.network}, {m.status}
                </div>
                <div className="truncate mono text-xs text-[var(--faint)]" title={m.owner}>
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