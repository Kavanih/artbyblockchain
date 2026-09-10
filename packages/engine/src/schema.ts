import { z } from "zod";

const unit = z.number().min(0).max(1);
const Vec3 = z.tuple([unit, unit, unit]);
const Vec2 = z.tuple([z.number().min(-4).max(4), z.number().min(-4).max(4)]);

export const NoiseSchema = z.object({
  octaves: z.number().int().min(1).max(16),
  frequency: z.number().min(0.05).max(60),
  seed: z.number().min(0).max(1000),
  amplitude: z.number().min(-1).max(1),
  color: Vec3.default([1, 1, 1]),
  mode: z.enum(["add", "cloud"]).default("add"),
  threshold: z.number().min(-1).max(1).default(0.2),
  gain: z.number().min(0).max(8).default(2)
});

export const StripesSchema = z.object({
  frequency: z.number().min(0.1).max(200),
  angle: z.number().min(-7).max(7),
  contrast: z.number().min(-1).max(1)
});

export const ShadingSchema = z.object({
  color: Vec3,
  edge: Vec3,
  stripes: StripesSchema.optional(),
  noise: NoiseSchema.optional()
});

export const ShapeSchema = z.object({
  kind: z.enum(["disc", "ring", "band"]),
  squareness: z.number().min(0.5).max(8).default(2),
  scallop: z
    .object({
      count: z.number().int().min(1).max(64),
      depth: z.number().min(0).max(1)
    })
    .optional(),
  ringWidth: z.number().min(0.02).max(1).default(0.2),
  wave: z
    .object({
      frequency: z.number().min(0.1).max(60),
      amplitude: z.number().min(0).max(1)
    })
    .optional()
});

export const ArrangementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("single") }),
  z.object({
    kind: z.literal("grid"),
    cols: z.number().int().min(1).max(24),
    rows: z.number().int().min(1).max(16),
    spacing: Vec2,
    perspective: z.number().min(0).max(3).default(0),
    depthFade: z.number().min(0).max(1).default(0),
    stagger: z.number().min(0).max(1).default(0),
    jitter: z.number().min(0).max(1).default(0)
  }),
  z.object({
    kind: z.literal("ring"),
    count: z.number().int().min(1).max(64),
    radius: z.number().min(0).max(4),
    faceOut: z.boolean().default(true),
    phase: z.number().min(-7).max(7).default(0)
  }),
  z.object({
    kind: z.literal("scatter"),
    count: z.number().int().min(1).max(200),
    spread: Vec2,
    sizeJitter: z.number().min(0).max(1).default(0),
    shrink: z.number().min(0).max(0.2).default(0)
  })
]);

export const LayerSchema = z.object({
  name: z.string().max(40).optional(),
  shape: ShapeSchema,
  arrangement: ArrangementSchema,
  center: Vec2,
  size: z.tuple([z.number().min(0.005).max(8), z.number().min(0.005).max(8)]),
  rotation: z.number().min(-7).max(7).default(0),
  softness: z.number().min(5).max(2000).default(200),
  shading: ShadingSchema
});

export const BackgroundSchema = z.object({
  top: Vec3,
  bottom: Vec3,
  noise: NoiseSchema.optional()
});

export const ParamsSchema = z.object({
  version: z.literal(1),
  title: z.string().max(80).optional(),
  seed: z.number().min(0).max(1000).default(0),
  view: z.object({
    scale: z.number().min(0.1).max(10).default(1),
    cx: z.number().min(-4).max(4).default(0),
    cy: z.number().min(-4).max(4).default(0)
  }),
  background: BackgroundSchema,
  layers: z.array(LayerSchema).max(24)
});

export type Params = z.infer<typeof ParamsSchema>;
export type ParamsInput = z.input<typeof ParamsSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Noise = z.infer<typeof NoiseSchema>;
export type Arrangement = z.infer<typeof ArrangementSchema>;

export const MAX_INSTANCES = 600;

export function instanceCount(a: Arrangement): number {
  switch (a.kind) {
    case "single":
      return 1;
    case "grid":
      return a.cols * a.rows;
    case "ring":
    case "scatter":
      return a.count;
  }
}

// Parse and apply defaults; also enforces the total instance budget.
export function parseParams(input: unknown): Params {
  const p = ParamsSchema.parse(input);
  const total = p.layers.reduce((n, l) => n + instanceCount(l.arrangement), 0);
  if (total > MAX_INSTANCES) {
    throw new Error(`too many shape instances: ${total} > ${MAX_INSTANCES}`);
  }
  return p;
}

export function safeParseParams(input: unknown): { ok: true; params: Params } | { ok: false; error: string } {
  try {
    return { ok: true, params: parseParams(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
