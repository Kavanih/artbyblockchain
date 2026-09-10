import { BlockSummary } from "./types";

export const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const NETWORK = process.env.SOLANA_NETWORK_NAME ?? "mainnet-beta";

export class BlockNotFoundError extends Error {
  constructor(public slot: number, message?: string) {
    super(message ?? `block for slot ${slot} is not available`);
  }
}

let rpcId = 1;
export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`rpc ${method} failed: HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { code: number; message: string } };
  if (json.error) {
    const err = new Error(`rpc ${method}: ${json.error.message}`);
    (err as Error & { code?: number }).code = json.error.code;
    throw err;
  }
  return json.result as T;
}

interface RawBlock {
  blockhash: string;
  previousBlockhash: string;
  parentSlot: number;
  blockHeight: number | null;
  blockTime: number | null;
  transactions: {
    meta: { err: unknown; fee: number; computeUnitsConsumed?: number; loadedAddresses?: { writable: string[]; readonly: string[] } } | null;
    transaction: {
      signatures: string[];
      message: { accountKeys: string[]; instructions: { programIdIndex: number }[] };
    };
  }[];
}

// Reduce a raw block into the fields the art mapping consumes.
export function summarize(slot: number, b: RawBlock, network = NETWORK): BlockSummary {
  const programs = new Set<string>();
  let totalFees = 0;
  let failed = 0;
  let cu = 0;
  const signatures: string[] = [];
  for (const tx of b.transactions) {
    const keys = [
      ...tx.transaction.message.accountKeys,
      ...(tx.meta?.loadedAddresses?.writable ?? []),
      ...(tx.meta?.loadedAddresses?.readonly ?? [])
    ];
    for (const ix of tx.transaction.message.instructions) {
      const k = keys[ix.programIdIndex];
      if (k) programs.add(k);
    }
    totalFees += tx.meta?.fee ?? 0;
    cu += tx.meta?.computeUnitsConsumed ?? 0;
    if (tx.meta?.err) failed++;
    if (tx.transaction.signatures[0]) signatures.push(tx.transaction.signatures[0]);
  }
  return {
    chain: "solana",
    network,
    slot,
    blockhash: b.blockhash,
    previousBlockhash: b.previousBlockhash,
    parentSlot: b.parentSlot,
    blockHeight: b.blockHeight ?? null,
    blockTime: b.blockTime ?? null,
    txCount: b.transactions.length,
    failedTxCount: failed,
    totalFees,
    computeUnits: cu,
    programIds: [...programs].sort(),
    signatures
  };
}

export async function fetchBlockSummary(slot: number): Promise<BlockSummary> {
  if (!Number.isInteger(slot) || slot < 0) throw new BlockNotFoundError(slot, "slot must be a non-negative integer");
  let raw: RawBlock | null = null;
  // Public RPCs rate limit; retry transient failures with a short backoff.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      raw = await rpc<RawBlock | null>("getBlock", [
        slot,
        { encoding: "json", maxSupportedTransactionVersion: 0, transactionDetails: "full", rewards: false }
      ]);
      break;
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code !== undefined && code <= -32000 && code >= -32016) throw new BlockNotFoundError(slot, (e as Error).message);
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  if (!raw) throw new BlockNotFoundError(slot);
  return summarize(slot, raw);
}

export async function fetchCurrentSlot(): Promise<number> {
  return rpc<number>("getSlot", [{ commitment: "finalized" }]);
}

// Most recent confirmed slots, newest first.
export async function fetchRecentSlots(count: number): Promise<number[]> {
  const tip = await fetchCurrentSlot();
  const slots = await rpc<number[]>("getBlocks", [Math.max(0, tip - count * 4), tip, { commitment: "finalized" }]);
  return slots.sort((a, b) => b - a).slice(0, count);
}
