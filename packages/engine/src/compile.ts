import {
  Expr,
  LayerGroup,
  Program,
  abs,
  add,
  atan2,
  cos,
  div,
  floor,
  mul,
  neg,
  num,
  pow,
  ref,
  sin,
  smask,
  sq,
  sub,
  sum,
  tri,
  sqrt
} from "./ir";
import { Layer, Noise, Params, instanceCount } from "./schema";

const PI = Math.PI;
const TWO_PI = 2 * Math.PI;

// Fractal noise: E = (1/N) sum_k (25/26)^k T_k, with T_k a product of two
// cosines whose frequency grows like (23/20)^k and phases come from cos(7k).
export function noiseField(n: Noise): Expr {
  const x = ref("x");
  const y = ref("y");
  const k = ref("k");
  const seed = num(n.seed);
  const freq = mul(num(n.frequency), pow(num(23 / 20), k));
  const a1 = add(mul(num(10), k), seed);
  const a2 = add(a1, num(2));
  const dir = (a: Expr) => add(mul(x, cos(a)), mul(y, sin(a)));
  const t1 = cos(add(mul(freq, dir(a1)), mul(num(100), cos(add(mul(num(7), k), seed)))));
  const t2 = cos(add(mul(freq, dir(a2)), mul(num(100), cos(add(mul(num(5), k), seed)))));
  const body = mul(pow(num(25 / 26), k), mul(t1, t2));
  let norm = 0;
  for (let i = 1; i <= n.octaves; i++) norm += Math.pow(25 / 26, i);
  return div(sum("k", 1, n.octaves, body), num(norm));
}

// Per-channel contribution of a noise field named `E`.
function noiseContribution(n: Noise, E: Expr, channel: number): Expr {
  const amp = num(n.amplitude * n.color[channel]);
  if (n.mode === "add") return mul(amp, E);
  const d = sub(E, num(n.threshold));
  return mul(amp, mul(num(n.gain), mul(smask(d, num(60)), d)));
}

interface InstanceFrame {
  defs: { name: string; value: Expr }[];
  cx: Expr;
  cy: Expr;
  scale: Expr;
  rot: Expr;
  depth: Expr;
}

function instanceFrame(l: Layer, li: number, seed: number): InstanceFrame {
  const s = ref("s");
  const a = l.arrangement;
  const [cx0, cy0] = l.center;
  const defs: { name: string; value: Expr }[] = [];
  const nm = (base: string) => `${base}_${li}`;
  switch (a.kind) {
    case "single":
      return { defs, cx: num(cx0), cy: num(cy0), scale: num(1), rot: num(l.rotation), depth: num(0) };
    case "grid": {
      const cols = a.cols;
      const j = floor(div(s, num(cols)));
      const i = sub(s, mul(num(cols), j));
      defs.push({ name: nm("j"), value: j });
      defs.push({ name: nm("i"), value: i });
      const J = ref(nm("j"));
      const I = ref(nm("i"));
      const k = div(num(1), add(num(1), mul(num(a.perspective), J)));
      defs.push({ name: nm("k"), value: k });
      const K = ref(nm("k"));
      const stag = a.stagger ? mul(num(0.5 * a.stagger), sub(J, mul(num(2), floor(div(J, num(2)))))) : num(0);
      const jx = a.jitter ? mul(num(a.jitter * 0.5), cos(add(mul(num(3), s), num(seed)))) : num(0);
      const jy = a.jitter ? mul(num(a.jitter * 0.5), cos(add(mul(num(5), s), num(seed)))) : num(0);
      const ox = add(add(sub(I, num((cols - 1) / 2)), stag), jx);
      const cx = add(num(cx0), mul(num(a.spacing[0]), mul(K, ox)));
      const cy = add(num(cy0), mul(num(a.spacing[1]), mul(K, add(J, jy))));
      return { defs, cx, cy, scale: K, rot: num(l.rotation), depth: sub(num(1), K) };
    }
    case "ring": {
      const ang = add(mul(num(TWO_PI / a.count), s), num(a.phase));
      defs.push({ name: nm("a"), value: ang });
      const A = ref(nm("a"));
      const cx = add(num(cx0), mul(num(a.radius), cos(A)));
      const cy = add(num(cy0), mul(num(a.radius), sin(A)));
      const rot = a.faceOut ? add(num(l.rotation), A) : num(l.rotation);
      return { defs, cx, cy, scale: num(1), rot, depth: num(0) };
    }
    case "scatter": {
      const cx = add(num(cx0), mul(num(a.spread[0]), cos(add(mul(num(3), s), num(seed)))));
      const cy = add(num(cy0), mul(num(a.spread[1]), cos(add(mul(num(5), s), num(2 * seed + 1)))));
      let k: Expr = num(1);
      if (a.sizeJitter) k = add(num(1), mul(num(a.sizeJitter), cos(add(mul(num(7), s), num(seed)))));
      if (a.shrink) k = mul(k, pow(num(1 - a.shrink), s));
      defs.push({ name: nm("k"), value: k });
      const K = ref(nm("k"));
      return { defs, cx, cy, scale: K, rot: num(l.rotation), depth: sub(num(1), K) };
    }
  }
}

export function compileLayer(l: Layer, li: number, p: Params, noiseName: string | null): LayerGroup {
  const nm = (base: string) => `${base}_${li}`;
  const frame = instanceFrame(l, li, p.seed);
  const defs = [...frame.defs];
  const x = ref("x");
  const y = ref("y");
  defs.push({ name: nm("cx"), value: frame.cx });
  defs.push({ name: nm("cy"), value: frame.cy });
  defs.push({ name: nm("phi"), value: frame.rot });
  const dx = sub(x, ref(nm("cx")));
  const dy = sub(y, ref(nm("cy")));
  const phi = ref(nm("phi"));
  defs.push({ name: nm("cphi"), value: cos(phi) });
  defs.push({ name: nm("sphi"), value: sin(phi) });
  const cphi = ref(nm("cphi"));
  const sphi = ref(nm("sphi"));
  const rx = mul(num(l.size[0]), frame.scale);
  const ry = mul(num(l.size[1]), frame.scale);
  defs.push({ name: nm("u"), value: div(add(mul(dx, cphi), mul(dy, sphi)), rx) });
  defs.push({ name: nm("v"), value: div(sub(mul(dy, cphi), mul(dx, sphi)), ry) });
  const u = ref(nm("u"));
  const v = ref(nm("v"));

  const sh = l.shape;
  let rho: Expr;
  if (sh.kind === "band") {
    rho = abs(v);
  } else if (sh.squareness === 2) {
    rho = sqrt(add(sq(u), sq(v)));
  } else {
    const pw = num(sh.squareness);
    rho = pow(add(pow(abs(u), pw), pow(abs(v), pw)), num(1 / sh.squareness));
  }
  defs.push({ name: nm("rho"), value: rho });
  const R = ref(nm("rho"));

  let edge: Expr = num(1);
  if (sh.scallop && sh.kind !== "band") {
    defs.push({ name: nm("theta"), value: atan2(v, u) });
    const T = ref(nm("theta"));
    edge = sub(num(1), mul(num(sh.scallop.depth), tri(mul(num(sh.scallop.count), T))));
  }
  const soft = num(l.softness);
  let mask: Expr;
  if (sh.kind === "disc") {
    mask = smask(sub(edge, R), soft);
  } else if (sh.kind === "ring") {
    mask = smask(sub(num(sh.ringWidth), abs(sub(edge, R))), soft);
  } else {
    const w = sh.wave ? mul(num(sh.wave.amplitude), cos(mul(num(sh.wave.frequency), u))) : num(0);
    const across = smask(sub(num(1), abs(sub(v, w))), soft);
    const along = smask(sub(num(1), abs(u)), soft);
    mask = mul(across, along);
  }
  defs.push({ name: nm("M"), value: mask });

  const shade = l.shading;
  if (shade.stripes) {
    const st = shade.stripes;
    const t = mul(num(st.frequency), add(mul(u, num(Math.cos(st.angle))), mul(v, num(Math.sin(st.angle)))));
    defs.push({ name: nm("st"), value: sub(tri(t), num(0.5)) });
  }
  const color: Expr[] = [];
  for (let c = 0; c < 3; c++) {
    let w: Expr = add(num(shade.color[c]), mul(num(shade.edge[c] - shade.color[c]), R));
    if (shade.stripes) {
      w = add(w, mul(num(shade.stripes.contrast), ref(nm("st"))));
    }
    if (shade.noise && noiseName) {
      w = add(w, noiseContribution(shade.noise, ref(noiseName), c));
    }
    if (l.arrangement.kind === "grid" && l.arrangement.depthFade > 0) {
      const f = mul(num(l.arrangement.depthFade), frame.depth);
      w = add(mul(w, sub(num(1), f)), mul(num(p.background.top[c]), f));
    }
    color.push(w);
  }
  return {
    name: l.name ?? `layer ${li}`,
    count: instanceCount(l.arrangement),
    loopVar: "s",
    defs,
    mask: ref(nm("M")),
    color: [color[0], color[1], color[2]],
    // exp(-k g) overflows to Infinity once k g < -710, making the mask 0.
    cull: { u: nm("u"), v: nm("v"), bound: 2 + 712 / l.softness }
  };
}

export function compile(p: Params): Program {
  const defs: { name: string; value: Expr }[] = [];
  const view = p.view;
  const y = ref("y");
  // t in [0, 1] from top to bottom of the view window.
  const t = div(sub(num(view.cy + view.scale), y), num(2 * view.scale));
  defs.push({ name: "t", value: t });
  let bgNoise: string | null = null;
  if (p.background.noise) {
    defs.push({ name: "E_bg", value: noiseField(p.background.noise) });
    bgNoise = "E_bg";
  }
  const background: Expr[] = [];
  for (let c = 0; c < 3; c++) {
    let b: Expr = add(num(p.background.top[c]), mul(num(p.background.bottom[c] - p.background.top[c]), ref("t")));
    if (p.background.noise && bgNoise) b = add(b, noiseContribution(p.background.noise, ref(bgNoise), c));
    background.push(b);
  }
  const groups: LayerGroup[] = [];
  p.layers.forEach((l, li) => {
    let noiseName: string | null = null;
    if (l.shading.noise) {
      noiseName = `E_${li}`;
      defs.push({ name: noiseName, value: noiseField(l.shading.noise) });
    }
    groups.push(compileLayer(l, li, p, noiseName));
  });
  return {
    defs,
    groups,
    background: [background[0], background[1], background[2]],
    view: { scale: view.scale, cx: view.cx, cy: view.cy }
  };
}

export { PI, neg };
