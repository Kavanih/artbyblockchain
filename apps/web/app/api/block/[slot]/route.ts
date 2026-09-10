import { NextResponse } from "next/server";
import { BlockNotFoundError } from "@/lib/solana";
import { getBlockArt, parseSlot } from "@/lib/block-art";
import { MAPPING_VERSION } from "@/lib/mapping";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slot: string }> }) {
  const { slot: raw } = await ctx.params;
  const slot = parseSlot(raw);
  if (slot === null) return NextResponse.json({ error: "invalid slot" }, { status: 400 });
  try {
    const art = await getBlockArt(slot);
    return NextResponse.json({ mappingVersion: MAPPING_VERSION, ...art });
  } catch (e) {
    if (e instanceof BlockNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
