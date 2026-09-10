import { createHash } from "node:crypto";
import bs58 from "bs58";
import type { Params } from "@slotart/engine";
import type { BlockSummary } from "./types";
import { MAPPING_VERSION } from "./mapping";

export type MintNetwork = "devnet" | "mainnet-beta";

export interface MintInput {
  kind: "block" | "custom";
  network: MintNetwork;
  owner: string;
  params: Params;
  paramsHash: string;
  imageHash: string;
  block?: BlockSummary;
}

export interface MintOutcome {
  assetAddress: string;
  txSignature: string;
  status: "dummy" | "confirmed";
}

// Anything that can put an asset on chain. The dummy version records the
// claim only; a Metaplex Core implementation slots in behind this interface.
export interface Minter {
  readonly name: string;
  mint(input: MintInput, metadata: NftMetadata): Promise<MintOutcome>;
}

export interface NftMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  attributes: { trait_type: string; value: string | number }[];
  properties: {
    category: "image";
    engine: string;
    mappingVersion?: number;
    blockRef?: { chain: string; network: string; slot: number; blockhash: string; parentSlot: number; blockTime: number | null };
    params: Params;
  };
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildMetadata(input: MintInput, siteUrl: string): NftMetadata {
  const b = input.block;
  const name = b ? `Slot Art #${b.slot}` : `Slot Art ${input.params.title ?? "custom"}`.slice(0, 32);
  const attributes: NftMetadata["attributes"] = [
    { trait_type: "kind", value: input.kind },
    { trait_type: "engine", value: "slotart-engine@1" },
    { trait_type: "layers", value: input.params.layers.length },
    { trait_type: "imageHash", value: input.imageHash },
    { trait_type: "paramsHash", value: input.paramsHash }
  ];
  if (b) {
    attributes.push(
      { trait_type: "chain", value: b.chain },
      { trait_type: "sourceNetwork", value: b.network },
      { trait_type: "slot", value: b.slot },
      { trait_type: "blockhash", value: b.blockhash },
      { trait_type: "transactions", value: b.txCount },
      { trait_type: "totalFees", value: b.totalFees },
      { trait_type: "mappingVersion", value: MAPPING_VERSION }
    );
  }
  return {
    name,
    symbol: "SLOTART",
    description: b
      ? `A formula-only image derived deterministically from Solana slot ${b.slot}. Recompute it from MAPPING.md.`
      : "A formula-only image. The parameters below fully define every pixel.",
    // Image upload to Arweave or IPFS is not wired yet; the render route is authoritative.
    image: b ? `${siteUrl}/api/render?slot=${b.slot}&size=512` : `${siteUrl}/api/render`,
    external_url: b ? `${siteUrl}/block?slot=${b.slot}` : `${siteUrl}/create`,
    attributes,
    properties: {
      category: "image",
      engine: "slotart-engine@1",
      mappingVersion: b ? MAPPING_VERSION : undefined,
      blockRef: b
        ? { chain: b.chain, network: b.network, slot: b.slot, blockhash: b.blockhash, parentSlot: b.parentSlot, blockTime: b.blockTime }
        : undefined,
      params: input.params
    }
  };
}

// Deterministic placeholder addresses so dummy mints are recognisable.
export class DummyMinter implements Minter {
  readonly name = "dummy";
  async mint(input: MintInput): Promise<MintOutcome> {
    const seed = createHash("sha256").update(`${input.network}:${input.kind}:${input.block?.slot ?? input.paramsHash}`).digest();
    const sig = createHash("sha512").update(seed).update(input.owner).digest();
    return { assetAddress: bs58.encode(seed), txSignature: bs58.encode(sig), status: "dummy" };
  }
}

export function getMinter(): Minter {
  return new DummyMinter();
}
