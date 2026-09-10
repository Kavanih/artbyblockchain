import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { presets } from "@slotart/engine";
import { prisma } from "./db";
import { MintError, performMint } from "./mint";
import { putCached } from "./cache";
import { summarize } from "./solana";

// Requires DATABASE_URL to point at a reachable Postgres (see README).
const GENESIS = summarize(0, {
  blockhash: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn",
  previousBlockhash: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn",
  parentSlot: 0,
  blockHeight: 0,
  blockTime: 1584368940,
  transactions: []
});
const TEST_SLOT = 900_000_000_001;

describe("mint service", () => {
  const owner = Keypair.generate().publicKey.toBase58();
  beforeAll(async () => {
    putCached({ ...GENESIS, slot: TEST_SLOT });
    await prisma.mint.deleteMany({ where: { owner } });
    await prisma.slotClaim.deleteMany({ where: { slot: BigInt(TEST_SLOT) } });
  });
  afterAll(async () => {
    await prisma.mint.deleteMany({ where: { owner } });
    await prisma.slotClaim.deleteMany({ where: { slot: BigInt(TEST_SLOT) } });
    await prisma.$disconnect();
  });

  it("rejects bad owners and mainnet when disabled", async () => {
    delete process.env.ENABLE_MAINNET;
    delete process.env.NEXT_PUBLIC_ENABLE_MAINNET;
    await expect(performMint({ kind: "custom", params: presets.sky, owner: "nope", network: "devnet" }, "http://x")).rejects.toThrow(MintError);
    await expect(performMint({ kind: "custom", params: presets.sky, owner, network: "mainnet-beta" }, "http://x")).rejects.toMatchObject({ status: 403 });
  });

  it("claims a slot once and refuses the second claim", async () => {
    const first = await performMint({ kind: "block", slot: TEST_SLOT, owner, network: "devnet" }, "http://x");
    expect(first.dummy).toBe(true);
    expect(first.metadata.properties.blockRef?.slot).toBe(TEST_SLOT);
    expect(first.mint.imageHash).toMatch(/^[0-9a-f]{64}$/);
    await expect(performMint({ kind: "block", slot: TEST_SLOT, owner, network: "devnet" }, "http://x")).rejects.toMatchObject({ status: 409 });
    const claim = await prisma.slotClaim.findUnique({ where: { chain_network_slot: { chain: "solana", network: "devnet", slot: BigInt(TEST_SLOT) } } });
    expect(claim?.owner).toBe(owner);
  });

  it("mints custom params without a claim", async () => {
    const r = await performMint({ kind: "custom", params: presets.flower, owner, network: "devnet" }, "http://x");
    expect(r.mint.claimId).toBeNull();
    expect(r.mint.paramsHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
