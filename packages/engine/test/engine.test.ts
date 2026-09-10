import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compile, paramsToLatex, presets, presetNames, programToGlsl, programToJs, renderCPU, parseParams } from "../src";
import { encodePNG, renderPNG, sha256 } from "../src/node";

const OUT = join(__dirname, "out");
mkdirSync(OUT, { recursive: true });

describe("clamp function", () => {
  const F = new Function(`${programToJs(compile(presets.sky)).split("\n")[0]}; return F;`)() as (t: number) => number;
  it("clamps to 0..255", () => {
    expect(F(-1)).toBe(0);
    expect(F(-0.001)).toBe(0);
    expect(F(0)).toBe(0);
    expect(F(0.5)).toBe(127);
    expect(F(0.999)).toBe(254);
    expect(F(1)).toBe(255);
    expect(F(1.7)).toBe(255);
    expect(F(50)).toBe(255);
  });
});

describe("presets", () => {
  for (const name of presetNames) {
    it(`${name} renders deterministically`, () => {
      const p = presets[name];
      const a = renderCPU(p, 96, 64);
      const b = renderCPU(p, 96, 64);
      expect(sha256(a.rgba)).toBe(sha256(b.rgba));
      // Image must not be flat.
      const first = a.rgba[0] + a.rgba[1] * 256 + a.rgba[2] * 65536;
      let differs = false;
      for (let i = 0; i < a.rgba.length; i += 4) {
        if (a.rgba[i] + a.rgba[i + 1] * 256 + a.rgba[i + 2] * 65536 !== first) {
          differs = true;
          break;
        }
      }
      expect(differs).toBe(true);
    });
    it(`${name} compiles to GLSL and LaTeX`, () => {
      const glsl = programToGlsl(compile(presets[name]));
      expect(glsl).toContain("void main()");
      expect(glsl).not.toMatch(/NaN|undefined/);
      const doc = paramsToLatex(presets[name]);
      expect(doc.layers.length).toBe(presets[name].layers.length);
      expect(doc.composite[2].latex).toContain("\\sum");
    });
  }
});

describe("png output", () => {
  it("writes valid PNG files with stable hashes", () => {
    const hashes: Record<string, string> = {};
    for (const name of presetNames) {
      const { png, hash } = renderPNG(presets[name], 256, 256);
      expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      writeFileSync(join(OUT, `${name}.png`), png);
      hashes[name] = hash;
      const again = renderPNG(presets[name], 256, 256);
      expect(again.hash).toBe(hash);
      expect(sha256(again.png)).toBe(sha256(png));
    }
    writeFileSync(join(OUT, "hashes.json"), JSON.stringify(hashes, null, 2));
  });
  it("encodes a tiny known image", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const png = encodePNG(rgba, 2, 1);
    expect(png.length).toBeGreaterThan(40);
  });
});

describe("schema", () => {
  it("rejects invalid params", () => {
    expect(() => parseParams({ version: 1, view: {}, background: { top: [2, 0, 0], bottom: [0, 0, 0] }, layers: [] })).toThrow();
    expect(() =>
      parseParams({
        version: 1,
        view: {},
        background: { top: [0, 0, 0], bottom: [0, 0, 0] },
        layers: [
          {
            shape: { kind: "disc" },
            arrangement: { kind: "scatter", count: 200, spread: [1, 1] },
            center: [0, 0],
            size: [0.1, 0.1],
            shading: { color: [1, 1, 1], edge: [0, 0, 0] }
          },
          {
            shape: { kind: "disc" },
            arrangement: { kind: "grid", cols: 24, rows: 16, spacing: [1, 1] },
            center: [0, 0],
            size: [0.1, 0.1],
            shading: { color: [1, 1, 1], edge: [0, 0, 0] }
          },
          {
            shape: { kind: "disc" },
            arrangement: { kind: "grid", cols: 24, rows: 16, spacing: [1, 1] },
            center: [0, 0],
            size: [0.1, 0.1],
            shading: { color: [1, 1, 1], edge: [0, 0, 0] }
          }
        ]
      })
    ).toThrow(/too many/);
  });
  it("applies defaults", () => {
    const p = parseParams({ version: 1, view: {}, background: { top: [0, 0, 0], bottom: [1, 1, 1] }, layers: [] });
    expect(p.view.scale).toBe(1);
    expect(p.seed).toBe(0);
  });
});
