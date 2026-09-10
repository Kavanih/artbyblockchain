import { Params } from "@slotart/engine";
import { getBlockSummary } from "./cache";
import { blockToParams } from "./mapping";
import { BlockSummary } from "./types";

export interface BlockArt {
  block: BlockSummary;
  params: Params;
}

export async function getBlockArt(slot: number): Promise<BlockArt> {
  const block = await getBlockSummary(slot);
  return { block, params: blockToParams(block) };
}

export function parseSlot(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const s = raw.trim().toLowerCase();
  if (s === "genesis") return 0;
  if (!/^\d{1,12}$/.test(s)) return null;
  return Number(s);
}
