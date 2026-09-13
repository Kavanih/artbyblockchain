import { BlockNotFoundError } from "@/lib/solana";
import { getBlockArt, parseSlot } from "@/lib/block-art";
import { paramsToLatex } from "@slotart/engine";
import { BlockArtView } from "@/components/BlockArtView";
import { SlotForm } from "@/components/SlotForm";

export const dynamic = "force-dynamic";

export default async function BlockPage({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const { slot: rawSlot } = await searchParams;
  const slot = parseSlot(rawSlot);
  let content: React.ReactNode = null;
  if (rawSlot !== undefined && slot === null) {
    content = (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Enter a slot number or the word genesis.
      </div>
    );
  } else if (slot !== null) {
    try {
      const art = await getBlockArt(slot);
      const doc = paramsToLatex(art.params);
      content = <BlockArtView block={art.block} params={art.params} doc={doc} />;
    } catch (e) {
      const msg = e instanceof BlockNotFoundError ? e.message : `Could not fetch block: ${(e as Error).message}`;
      content = (
        <p className="text-red-600" data-testid="block-error">
          {msg}
        </p>
      );
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">Block art</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Render a slot</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Pick a Solana slot. The block data seeds every constant of the formula; see MAPPING.md for the rules.
        </p>
      </div>
      <SlotForm initial={rawSlot ?? ""} />
      {content}
    </div>
  );
}