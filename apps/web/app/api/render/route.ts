import { NextResponse } from "next/server";
import { presets, safeParseParams } from "@slotart/engine";
import { renderPNG } from "@slotart/engine/node";
import { BlockNotFoundError } from "@/lib/solana";
import { getBlockArt, parseSlot } from "@/lib/block-art";

export const dynamic = "force-dynamic";
const MAX_SIZE = 1024;

function sizeOf(url: URL) {
  const s = Number(url.searchParams.get("size") ?? 512);
  return Math.max(16, Math.min(MAX_SIZE, Number.isFinite(s) ? Math.floor(s) : 512));
}

function pngResponse(png: Buffer, hash: string) {
  return new NextResponse(new Uint8Array(png), {
    headers: { "content-type": "image/png", "x-image-hash": hash, "cache-control": "public, max-age=3600" }
  });
}

// GET ?slot=N or ?preset=name renders the canonical CPU image.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = sizeOf(url);
  const preset = url.searchParams.get("preset");
  if (preset) {
    const p = presets[preset];
    if (!p) return NextResponse.json({ error: "unknown preset" }, { status: 404 });
    const { png, hash } = renderPNG(p, size, size);
    return pngResponse(png, hash);
  }
  const slot = parseSlot(url.searchParams.get("slot"));
  if (slot === null) return NextResponse.json({ error: "slot or preset required" }, { status: 400 });
  try {
    const art = await getBlockArt(slot);
    const { png, hash } = renderPNG(art.params, size, size);
    return pngResponse(png, hash);
  } catch (e) {
    if (e instanceof BlockNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// POST { params, size } renders arbitrary parameters.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { params?: unknown; size?: number } | null;
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });
  const parsed = safeParseParams(body.params);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const size = Math.max(16, Math.min(MAX_SIZE, Math.floor(body.size ?? 512)));
  const { png, hash } = renderPNG(parsed.params, size, size);
  return pngResponse(png, hash);
}
