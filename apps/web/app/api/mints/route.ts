import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeMint } from "@/lib/mint";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slot = url.searchParams.get("slot");
  if (slot !== null) {
    const claim = await prisma.slotClaim.findFirst({ where: { slot: BigInt(slot) }, include: { mint: true } });
    return NextResponse.json({ claimed: !!claim, claim: claim ? serializeMint(claim) : null });
  }
  const mints = await prisma.mint.findMany({ orderBy: { createdAt: "desc" }, take: 48, include: { claim: true } });
  return NextResponse.json({ mints: mints.map((m) => serializeMint(m)) });
}
