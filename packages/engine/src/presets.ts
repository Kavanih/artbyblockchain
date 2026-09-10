import { ParamsInput, parseParams, Params } from "./schema";

// Hand built presets that exercise every primitive.
const FIELD: ParamsInput = {
  version: 1,
  title: "Field of scalloped discs",
  seed: 3,
  view: { scale: 1, cx: 0, cy: 0.1 },
  background: {
    top: [0.36, 0.55, 0.85],
    bottom: [0.9, 0.93, 0.97],
    noise: {
      octaves: 10,
      frequency: 4,
      seed: 11,
      amplitude: 0.9,
      color: [1, 1, 1],
      mode: "cloud",
      threshold: 0.15,
      gain: 2.5
    }
  },
  layers: [
    {
      name: "discs",
      shape: { kind: "disc", squareness: 2, scallop: { count: 12, depth: 0.12 } },
      arrangement: {
        kind: "grid",
        cols: 9,
        rows: 7,
        spacing: [0.34, 0.26],
        perspective: 0.7,
        depthFade: 0.55,
        stagger: 1,
        jitter: 0.15
      },
      center: [0, -0.85],
      size: [0.17, 0.12],
      rotation: 0,
      softness: 400,
      shading: {
        color: [0.95, 0.55, 0.2],
        edge: [0.45, 0.1, 0.05],
        stripes: { frequency: 30, angle: 1.1, contrast: 0.18 }
      }
    },
    {
      name: "ground",
      shape: { kind: "band", wave: { frequency: 6, amplitude: 0.05 } },
      arrangement: { kind: "single" },
      center: [0, -1.4],
      size: [3, 0.7],
      rotation: 0,
      softness: 300,
      shading: {
        color: [0.25, 0.45, 0.2],
        edge: [0.6, 0.7, 0.4],
        noise: { octaves: 8, frequency: 12, seed: 5, amplitude: 0.12, color: [1, 1, 0.6], mode: "add" }
      }
    }
  ]
};

const SKY: ParamsInput = {
  version: 1,
  title: "Cloud sky",
  seed: 7,
  view: { scale: 1, cx: 0, cy: 0 },
  background: {
    top: [0.12, 0.3, 0.72],
    bottom: [0.85, 0.75, 0.7],
    noise: {
      octaves: 14,
      frequency: 3,
      seed: 42,
      amplitude: 1,
      color: [1, 0.97, 0.92],
      mode: "cloud",
      threshold: 0.05,
      gain: 2.2
    }
  },
  layers: [
    {
      name: "sun",
      shape: { kind: "disc", squareness: 2 },
      arrangement: { kind: "single" },
      center: [0.45, 0.35],
      size: [0.16, 0.16],
      rotation: 0,
      softness: 60,
      shading: { color: [1, 0.95, 0.7], edge: [1, 0.7, 0.35] }
    },
    {
      name: "halo",
      shape: { kind: "ring", squareness: 2, ringWidth: 0.35 },
      arrangement: { kind: "single" },
      center: [0.45, 0.35],
      size: [0.3, 0.3],
      rotation: 0,
      softness: 8,
      shading: { color: [1, 0.85, 0.6], edge: [0.9, 0.6, 0.5] }
    }
  ]
};

const FLOWER: ParamsInput = {
  version: 1,
  title: "Radial flower",
  seed: 5,
  view: { scale: 1, cx: 0, cy: 0 },
  background: {
    top: [0.06, 0.08, 0.12],
    bottom: [0.12, 0.1, 0.2],
    noise: { octaves: 8, frequency: 6, seed: 9, amplitude: 0.08, color: [0.6, 0.7, 1], mode: "add" }
  },
  layers: [
    {
      name: "centre",
      shape: { kind: "disc", squareness: 2, scallop: { count: 24, depth: 0.08 } },
      arrangement: { kind: "single" },
      center: [0, 0],
      size: [0.22, 0.22],
      rotation: 0,
      softness: 500,
      shading: {
        color: [0.95, 0.75, 0.2],
        edge: [0.5, 0.25, 0.05],
        stripes: { frequency: 40, angle: 0.8, contrast: 0.2 }
      }
    },
    {
      name: "inner petals",
      shape: { kind: "disc", squareness: 1.4 },
      arrangement: { kind: "ring", count: 8, radius: 0.36, faceOut: true, phase: 0 },
      center: [0, 0],
      size: [0.26, 0.11],
      rotation: 0,
      softness: 500,
      shading: {
        color: [0.95, 0.35, 0.5],
        edge: [0.55, 0.05, 0.25],
        stripes: { frequency: 24, angle: 0, contrast: 0.12 }
      }
    },
    {
      name: "outer petals",
      shape: { kind: "disc", squareness: 1.4 },
      arrangement: { kind: "ring", count: 12, radius: 0.6, faceOut: true, phase: 0.26 },
      center: [0, 0],
      size: [0.34, 0.14],
      rotation: 0,
      softness: 500,
      shading: {
        color: [0.85, 0.2, 0.45],
        edge: [0.35, 0.02, 0.2],
        stripes: { frequency: 20, angle: 0, contrast: 0.1 }
      }
    },
    {
      name: "leaves",
      shape: { kind: "disc", squareness: 1.2, scallop: { count: 2, depth: 0.15 } },
      arrangement: { kind: "ring", count: 6, radius: 0.85, faceOut: true, phase: 0.5 },
      center: [0, 0],
      size: [0.3, 0.1],
      rotation: 0,
      softness: 500,
      shading: { color: [0.2, 0.55, 0.25], edge: [0.05, 0.25, 0.1], stripes: { frequency: 60, angle: 1.4, contrast: 0.15 } }
    }
  ]
};

export const PRESET_INPUTS: Record<string, ParamsInput> = {
  field: FIELD,
  sky: SKY,
  flower: FLOWER
};

export const presets: Record<string, Params> = Object.fromEntries(
  Object.entries(PRESET_INPUTS).map(([k, v]) => [k, parseParams(v)])
);

export const presetNames = Object.keys(presets);
