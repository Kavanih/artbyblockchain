import { NextResponse } from "next/server";
import { z } from "zod";
import { BlockNotFoundError } from "@/lib/solana";
import { MintError, performMint, serializeMint } from "@/lib/mint";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  kind: z.enum(["block", "custom"]),
  slot: z.number().int().min(0).optional(),
  params: z.unknown().optional(),
  owner: z.string().min(32).max(64),
  network: z.string()
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    const { mint, dummy } = await performMint(parsed.data, siteUrl);
    return NextResponse.json({
      id: mint.id,
      assetAddress: mint.assetAddress,
      txSignature: mint.txSignature,
      imageHash: mint.imageHash,
      network: mint.network,
      dummy
    });
  } catch (e) {
    if (e instanceof MintError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof BlockNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("mint failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
