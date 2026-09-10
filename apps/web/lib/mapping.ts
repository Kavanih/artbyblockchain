import bs58 from "bs58";
import { ParamsInput, Params, parseParams } from "@slotart/engine";
import { BlockSummary } from "./types";

// Deterministic mapping from block data to formula parameters.
// Every rule here is documented in MAPPING.md; keep the two in sync.

export const MAPPING_VERSION = 1;
const TAU = 2 * Math.PI;

function decode(s: string): Uint8Array {
  try {
    return bs58.decode(s);
  } catch {
    return new Uint8Array(32);
  }
}

// hsl in [0,360) x [0,1] x [0,1] to rgb in [0,1]; standard CSS conversion.
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const clamp = (v: number) => Math.min(1, Math.max(0, Math.round((v + m) * 1000) / 1000));
  return [clamp(r), clamp(g), clamp(b)];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const mix = (a: number[], b: number[], t: number): [number, number, number] => [
  r3(a[0] + (b[0] - a[0]) * t),
  r3(a[1] + (b[1] - a[1]) * t),
  r3(a[2] + (b[2] - a[2]) * t)
];

export function blockToParams(b: BlockSummary): Params {
  const H = decode(b.blockhash);
  const sig = b.signatures.length > 0 ? decode(b.signatures[0]) : new Uint8Array([...H, ...H]);
  const h = (i: number) => H[i % H.length];
  const g = (i: number) => sig[i % sig.length];
  const uh = (i: number) => h(i) / 255;
  const ug = (i: number) => g(i) / 255;

  const T = b.txCount;
  const L = 1 + (T % 6);
  const K = b.programIds.length;
  const progBytes = b.programIds.map((p) => decode(p));
  const sum0 = progBytes.reduce((n, p) => n + p[0], 0);
  const sum1 = progBytes.reduce((n, p) => n + p[1], 0);
  const tau = b.blockTime ?? 0;
  const day = (1 - Math.cos((TAU * (tau % 86400)) / 86400)) / 2;
  const feeHue = Math.floor(b.totalFees / 1000) % 360;

  const background: ParamsInput["background"] = {
    top: mix([0.03, 0.04, 0.12], [0.25, 0.5, 0.9], day),
    bottom: mix([0.1, 0.08, 0.2], [0.9, 0.85, 0.8], day),
    noise: {
      octaves: 6 + (K % 9),
      frequency: r3(2 + (sum0 % 32) / 4),
      seed: sum1 % 1000,
      amplitude: r3(0.6 + 0.4 * uh(0)),
      color: [1, 0.97, 0.94],
      mode: "cloud",
      threshold: r3(0.05 + 0.25 * uh(1)),
      gain: 2
    }
  };

  const layers: ParamsInput["layers"] = [];
  for (let l = 0; l < L; l++) {
    const o = 2 + 5 * l;
    const q = 10 * l;
    const kindByte = h(o) % 5;
    const kind = kindByte <= 2 ? "disc" : kindByte === 3 ? "ring" : "band";
    const arrByte = h(o + 1) % 4;
    const countByte = h(o + 2);
    const cx = r3(-0.6 + 1.2 * uh(o + 3));
    const cy = r3(-0.6 + 1.2 * uh(o + 4));
    const rx = r3(0.05 + 0.3 * ug(q));
    const ry = r3(rx * (0.4 + 0.8 * ug(q + 1)));
    const rotation = r3(TAU * ug(q + 2));
    const hue = (feeHue + 137.5 * l) % 360;
    const sat = r3(0.5 + 0.4 * ug(q + 6));
    const light = r3(0.45 + 0.2 * ug(q + 7));
    const arrangement: ParamsInput["layers"][number]["arrangement"] =
      kind === "band"
        ? { kind: "single" }
        : arrByte === 0
        ? {
            kind: "grid",
            cols: 3 + (countByte % 8),
            rows: 2 + (Math.floor(countByte / 8) % 5),
            spacing: [r3(rx * 2.4), r3(ry * 2.4)],
            perspective: r3(0.3 + ug(q + 8)),
            depthFade: 0.4,
            stagger: 1,
            jitter: 0.2
          }
        : arrByte === 1
          ? {
              kind: "ring",
              count: 5 + (countByte % 12),
              radius: r3(0.25 + 0.5 * ug(q + 8)),
              faceOut: true,
              phase: r3(TAU * ug(q + 9))
            }
          : arrByte === 2
            ? {
                kind: "scatter",
                count: 8 + (countByte % 40),
                spread: [0.9, 0.9],
                sizeJitter: 0.4,
                shrink: 0.02
              }
            : { kind: "single" };
    layers.push({
      name: `layer ${l}`,
      shape: {
        kind,
        squareness: r3(1 + 2.5 * ug(q + 5)),
        ringWidth: 0.25,
        scallop: g(q + 3) % 2 === 1 ? { count: 3 + (g(q + 4) % 14), depth: r3(0.05 + 0.3 * ug(q + 4)) } : undefined,
        wave: kind === "band" ? { frequency: 2 + (g(q + 4) % 10), amplitude: r3(0.1 + 0.3 * ug(q + 3)) } : undefined
      },
      arrangement,
      center: [cx, kind === "band" ? r3(cy - 0.5) : cy],
      size: kind === "band" ? [3, r3(0.1 + 0.25 * ug(q + 1))] : [rx, ry],
      rotation: kind === "band" ? 0 : rotation,
      softness: 300,
      shading: {
        color: hslToRgb(hue, sat, light),
        edge: hslToRgb(hue + 20, sat, light * 0.5),
        stripes: g(q + 8) % 2 === 0 ? { frequency: 10 + (g(q + 9) % 50), angle: rotation, contrast: 0.15 } : undefined,
        noise:
          kind === "band"
            ? { octaves: 6, frequency: r3(6 + (sum0 % 16)), seed: sum1 % 1000, amplitude: 0.12, color: [1, 1, 0.8], mode: "add" }
            : undefined
      }
    });
  }

  const input: ParamsInput = {
    version: 1,
    title: `Solana slot ${b.slot}`,
    seed: b.slot % 1000,
    view: { scale: 1, cx: 0, cy: 0 },
    background,
    layers
  };
  return parseParams(input);
}
