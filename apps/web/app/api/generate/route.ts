import { NextResponse } from "next/server";
import { z } from "zod";
import { generateParams, mockCaller } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  mode: z.enum(["text", "image"]),
  text: z.string().max(2000).optional(),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/)
    .max(6_000_000)
    .optional()
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const body = parsed.data;
  if (body.mode === "text" && !body.text?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 });
  if (body.mode === "image" && !body.imageDataUrl) return NextResponse.json({ error: "image required" }, { status: 400 });
  const mock = process.env.LLM_MOCK === "1";
  if (!mock && !process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured on the server" }, { status: 503 });
  }
  try {
    const result = await generateParams(body, mock ? mockCaller : undefined);
    return NextResponse.json({ ...result, mock });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
