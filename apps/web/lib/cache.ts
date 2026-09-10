import { BlockSummary } from "./types";
import { fetchBlockSummary } from "./solana";

// Process-wide LRU of block summaries; survives across requests in one server.
const MAX = 128;
const store = new Map<number, BlockSummary>();
const pending = new Map<number, Promise<BlockSummary>>();

export function getCached(slot: number): BlockSummary | undefined {
  const v = store.get(slot);
  if (v) {
    store.delete(slot);
    store.set(slot, v);
  }
  return v;
}

export function putCached(summary: BlockSummary) {
  store.set(summary.slot, summary);
  if (store.size > MAX) store.delete(store.keys().next().value as number);
}

export async function getBlockSummary(slot: number): Promise<BlockSummary> {
  const hit = getCached(slot);
  if (hit) return hit;
  let p = pending.get(slot);
  if (!p) {
    p = fetchBlockSummary(slot).finally(() => pending.delete(slot));
    pending.set(slot, p);
  }
  const s = await p;
  putCached(s);
  return s;
}
