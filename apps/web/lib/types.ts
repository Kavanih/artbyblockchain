export interface BlockSummary {
  chain: "solana";
  network: string;
  slot: number;
  blockhash: string;
  previousBlockhash: string;
  parentSlot: number;
  blockHeight: number | null;
  blockTime: number | null;
  txCount: number;
  failedTxCount: number;
  totalFees: number;
  computeUnits: number;
  programIds: string[];
  signatures: string[];
}
