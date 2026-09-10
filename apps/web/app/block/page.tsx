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
    content = <p className="text-red-400">Enter a slot number or the word genesis.</p>;
  } else if (slot !== null) {
    try {
      const art = await getBlockArt(slot);
      const doc = paramsToLatex(art.params);
      content = <BlockArtView block={art.block} params={art.params} doc={doc} />;
    } catch (e) {
      const msg = e instanceof BlockNotFoundError ? e.message : `Could not fetch block: ${(e as Error).message}`;
      content = (
        <p className="text-red-400" data-testid="block-error">
          {msg}
        </p>
      );
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Block art</h1>
        <p className="text-[var(--muted)]">
          Pick a Solana slot. The block data seeds every constant of the formula; see MAPPING.md for the rules.
        </p>
      </div>
      <SlotForm initial={rawSlot ?? ""} />
      {content}
    </div>
  );
}
