import { Params, presets, safeParseParams } from "@slotart/engine";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "qwen/qwen2.5-vl-72b-instruct:free";
const MAX_ATTEMPTS = 3;

export interface GenerateRequest {
  mode: "text" | "image";
  text?: string;
  imageDataUrl?: string;
}

export interface GenerateResult {
  params: Params;
  attempts: number;
  model: string;
  notes?: string;
}

// Compact schema description given to the model. Kept in sync with
// packages/engine/src/schema.ts by the unit test in llm.test.ts.
export const SCHEMA_GUIDE = `
Output ONLY a JSON object with this shape (no prose, no markdown fences):
{
  "version": 1,
  "title": string (short),
  "seed": number 0..1000,
  "view": { "scale": 0.1..10 (1 = plane spans -1..1 vertically), "cx": -4..4, "cy": -4..4 },
  "background": {
    "top": [r,g,b] each 0..1, "bottom": [r,g,b],
    "noise"?: { "octaves": int 1..16, "frequency": 0.05..60, "seed": 0..1000, "amplitude": -1..1,
                "color": [r,g,b], "mode": "add" | "cloud", "threshold": -1..1, "gain": 0..8 }
  },
  "layers": [ up to 24 of
    {
      "name": string,
      "shape": { "kind": "disc" | "ring" | "band",
                 "squareness": 0.5..8 (2 = ellipse, 1 = diamond, 4+ = rounded rectangle),
                 "scallop"?: { "count": int 1..64, "depth": 0..1 } (petal or star edge),
                 "ringWidth": 0.02..1 (ring only),
                 "wave"?: { "frequency": 0.1..60, "amplitude": 0..1 } (band only) },
      "arrangement": one of
         { "kind": "single" }
         { "kind": "grid", "cols": int 1..24, "rows": int 1..16, "spacing": [sx, sy], "perspective": 0..3, "depthFade": 0..1, "stagger": 0..1, "jitter": 0..1 }
         { "kind": "ring", "count": int 1..64, "radius": 0..4, "faceOut": bool, "phase": -7..7 }
         { "kind": "scatter", "count": int 1..200, "spread": [sx, sy], "sizeJitter": 0..1, "shrink": 0..0.2 },
      "center": [x, y] each -4..4, "size": [rx, ry] each 0.005..8, "rotation": radians -7..7,
      "softness": 5..2000 (edge sharpness),
      "shading": { "color": [r,g,b], "edge": [r,g,b] (colour at the rim),
                   "stripes"?: { "frequency": 0.1..200, "angle": -7..7, "contrast": -1..1 },
                   "noise"?: same object as background noise }
    }
  ]
}
Rules: layers are drawn nearest first and occlude later layers. Total shape instances across all
layers must stay under 600. y points up. Use "grid" with perspective for fields of repeated objects,
"ring" with faceOut for flowers and petals, "scatter" for stars or foliage, "band" for ground, sea or
horizon, background noise in "cloud" mode for skies. Colours are linear RGB in 0..1.
`;

export function buildMessages(req: GenerateRequest, feedback: string | null) {
  const example = JSON.stringify(presets.flower);
  const system = `You convert descriptions or images into parameters for a formula-based image engine.
The engine only draws smooth shapes (ellipses, rings, bands, petals, stars) with gradients, stripes and
fractal noise, so results are stylised, never photoreal. Pick a composition that captures the subject.
${SCHEMA_GUIDE}
Example of a valid object (a flower): ${example}`;
  const content: unknown[] = [];
  if (req.mode === "image" && req.imageDataUrl) {
    content.push({ type: "text", text: "Approximate this image with the engine. Match the dominant colours, the main shapes, their positions and the background." });
    if (req.text) content.push({ type: "text", text: `Extra guidance: ${req.text}` });
    content.push({ type: "image_url", image_url: { url: req.imageDataUrl } });
  } else {
    content.push({ type: "text", text: `Description: ${req.text ?? ""}` });
  }
  const messages: { role: string; content: unknown }[] = [
    { role: "system", content: system },
    { role: "user", content }
  ];
  if (feedback) {
    messages.push({ role: "assistant", content: feedback.split("\n---\n")[0] });
    messages.push({ role: "user", content: `That output was rejected: ${feedback.split("\n---\n")[1]}. Return a corrected JSON object only.` });
  }
  return messages;
}

// Pull the first JSON object out of a model reply, tolerating fences.
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in reply");
  return JSON.parse(body.slice(start, end + 1));
}

type Caller = (messages: unknown[], model: string) => Promise<string>;

export async function callOpenRouter(messages: unknown[], model: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "http-referer": "https://slotart.local",
      "x-title": "Slot Art"
    },
    body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 4000 })
  });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (json.error) throw new Error(`OpenRouter: ${json.error.message}`);
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");
  return content;
}

// Deterministic stand-in used when LLM_MOCK=1 (tests, offline dev).
export async function mockCaller(messages: unknown[]): Promise<string> {
  const text = JSON.stringify(messages).toLowerCase();
  const pick = text.includes("flower") ? "flower" : text.includes("sky") || text.includes("cloud") ? "sky" : "field";
  return JSON.stringify({ ...presets[pick], title: `Mock ${pick}` });
}

export async function generateParams(req: GenerateRequest, caller: Caller = callOpenRouter): Promise<GenerateResult> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  let feedback: string | null = null;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await caller(buildMessages(req, feedback), model);
    try {
      const parsed = safeParseParams(extractJson(reply));
      if (parsed.ok) return { params: parsed.params, attempts: attempt, model };
      lastError = parsed.error;
    } catch (e) {
      lastError = (e as Error).message;
    }
    feedback = `${reply.slice(0, 6000)}\n---\n${lastError.slice(0, 1500)}`;
  }
  throw new Error(`model produced invalid parameters after ${MAX_ATTEMPTS} attempts: ${lastError.slice(0, 300)}`);
}
