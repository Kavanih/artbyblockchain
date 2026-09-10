import Link from "next/link";
import { fetchRecentSlots } from "@/lib/solana";
import { getBlockArt } from "@/lib/block-art";
import { FormulaCanvas } from "@/components/FormulaCanvas";

export const dynamic = "force-dynamic";

const COUNT = 8;

async function loadRecent() {
  const slots = await fetchRecentSlots(COUNT);
  const items = [];
  // Fetch a few at a time to stay under public RPC rate limits.
  for (let i = 0; i < slots.length; i += 3) {
    const chunk = await Promise.allSettled(slots.slice(i, i + 3).map((s) => getBlockArt(s)));
    for (const r of chunk) if (r.status === "fulfilled") items.push(r.value);
  }
  return items;
}

export default async function GalleryPage() {
  let items: Awaited<ReturnType<typeof loadRecent>> = [];
  let error: string | null = null;
  try {
    items = await loadRecent();
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Recent slots</h1>
      {error && <p className="text-red-400">Could not load recent blocks: {error}</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="gallery-grid">
        {items.map(({ block, params }) => (
          <Link key={block.slot} href={`/block?slot=${block.slot}`} className="panel overflow-hidden">
            <FormulaCanvas params={params} width={256} height={256} />
            <div className="px-3 py-2 text-xs">
              <div className="font-medium">Slot {block.slot}</div>
              <div className="text-[var(--muted)]">
                {block.txCount} txs, {params.layers.length} layers
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
