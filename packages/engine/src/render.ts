import { compile } from "./compile";
import { programToPixelFn } from "./backend-js";
import { Params } from "./schema";

export interface RenderResult {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

// Canonical CPU render. Deterministic: same params and size give the same
// bytes on any V8 runtime.
export function renderCPU(params: Params, width: number, height: number): RenderResult {
  const prog = compile(params);
  const px = programToPixelFn(prog);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const half = Math.min(width, height) / 2;
  const { scale, cx, cy } = prog.view;
  const out = [0, 0, 0];
  let o = 0;
  for (let n = 0; n < height; n++) {
    const y = cy + (scale * (height / 2 - n - 0.5)) / half;
    for (let m = 0; m < width; m++) {
      const x = cx + (scale * (m + 0.5 - width / 2)) / half;
      px(x, y, out);
      rgba[o] = out[0] === out[0] ? out[0] : 0;
      rgba[o + 1] = out[1] === out[1] ? out[1] : 0;
      rgba[o + 2] = out[2] === out[2] ? out[2] : 0;
      rgba[o + 3] = 255;
      o += 4;
    }
  }
  return { width, height, rgba };
}
