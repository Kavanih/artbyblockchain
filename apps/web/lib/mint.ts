import { Prisma } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";
import { renderCPU, safeParseParams, type Params } from "@slotart/engine";
import { sha256 } from "@slotart/engine/node";
import { prisma } from "./db";
import { getBlockArt } from "./block-art";
import { buildMetadata, getMinter, hashJson, type MintNetwork } from "./minter";

export const CANONICAL_SIZE = 512;

export class MintError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface MintRequest {
  kind: "block" | "custom";
  slot?: number;
  params?: unknown;
  owner: string;
  network: string;
}

function mainnetAllowed() {
  return process.env.ENABLE_MAINNET === "true" || process.env.NEXT_PUBLIC_ENABLE_MAINNET === "true";
}

export function validateOwner(owner: string): string {
  try {
    return new PublicKey(owner).toBase58();
  } catch {
    throw new MintError(400, "owner is not a valid Solana public key");
  }
}

export function validateNetwork(network: string): MintNetwork {
  if (network === "devnet") return "devnet";
  if (network === "mainnet-beta") {
    if (!mainnetAllowed()) throw new MintError(403, "mainnet minting is disabled");
    return "mainnet-beta";
  }
  throw new MintError(400, "unknown network");
}

export function canonicalImageHash(params: Params): string {
  return sha256(renderCPU(params, CANONICAL_SIZE, CANONICAL_SIZE).rgba);
}

// Records a mint. Block mints claim their slot; the unique index on
// SlotClaim is the single source of truth for "one mint per slot".
export async function performMint(req: MintRequest, siteUrl: string) {
  const owner = validateOwner(req.owner);
  const network = validateNetwork(req.network);
  let params: Params;
  let block = undefined;
  if (req.kind === "block") {
    if (req.slot === undefined || !Number.isInteger(req.slot) || req.slot < 0) throw new MintError(400, "slot required");
    const art = await getBlockArt(req.slot);
    block = art.block;
    params = art.params;
    const existing = await prisma.slotClaim.findUnique({ where: { chain_network_slot: { chain: block.chain, network, slot: BigInt(block.slot) } } });
    if (existing) throw new MintError(409, `slot ${block.slot} has already been minted on ${network}`);
  } else {
    const parsed = safeParseParams(req.params);
    if (!parsed.ok) throw new MintError(400, `invalid params: ${parsed.error}`);
    params = parsed.params;
  }
  const paramsHash = hashJson(params);
  const imageHash = canonicalImageHash(params);
  const input = { kind: req.kind, network, owner, params, paramsHash, imageHash, block };
  const metadata = buildMetadata(input, siteUrl);
  const outcome = await getMinter().mint(input, metadata);
  const data = {
    chain: "solana",
    network,
    kind: req.kind,
    owner,
    mappingVersion: block ? metadata.properties.mappingVersion : null,
    params: params as unknown as Prisma.InputJsonValue,
    paramsHash,
    imageHash,
    metadata: metadata as unknown as Prisma.InputJsonValue,
    assetAddress: outcome.assetAddress,
    txSignature: outcome.txSignature,
    status: outcome.status
  };
  try {
    const mint = block
      ? await prisma.mint.create({
          data: {
            ...data,
            claim: { create: { chain: block.chain, network, slot: BigInt(block.slot), blockhash: block.blockhash, owner } }
          }
        })
      : await prisma.mint.create({ data });
    return { mint, metadata, dummy: outcome.status === "dummy" };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new MintError(409, `slot ${block?.slot} has already been minted on ${network}`);
    }
    throw e;
  }
}

export function serializeMint(m: { id: string; slot?: bigint | null; [k: string]: unknown }) {
  return JSON.parse(JSON.stringify(m, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}
