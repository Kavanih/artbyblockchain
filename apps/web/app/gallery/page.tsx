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
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">Collection</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Recent slots</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          The most recent blocks on Solana, each rendered through the same formula engine. Every image is
          deterministic: the same slot always produces the same picture.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load recent blocks: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="gallery-grid">
        {items.map(({ block, params }) => (
          <Link
            key={block.slot}
            href={`/block?slot=${block.slot}`}
            className="group panel overflow-hidden transition-shadow hover:shadow-sm"
          >
            <FormulaCanvas params={params} width={320} height={320} className="block w-full" />
            <div className="flex items-baseline justify-between px-4 py-3">
              <div>
                <div className="font-serif text-lg font-medium tabular">Slot {block.slot}</div>
                <div className="text-xs text-[var(--muted)]">
                  {block.txCount} txs, {params.layers.length} layers
                </div>
              </div>
              <span className="text-xs text-[var(--faint)] transition-colors group-hover:text-[var(--accent)]">
                view
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}