// Expression IR shared by the CPU, GLSL and LaTeX backends.
// Every image is built from this small set of elementary operations.

export type Fn =
  | "cos"
  | "sin"
  | "exp"
  | "abs"
  | "floor"
  | "acos"
  | "atan2"
  | "sqrt"
  | "pow"
  | "smask"
  | "tri";

export type Expr =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "bin"; op: "+" | "-" | "*" | "/"; a: Expr; b: Expr }
  | { k: "neg"; a: Expr }
  | { k: "fn"; fn: Fn; args: Expr[] }
  | { k: "sum"; v: string; from: number; to: number; body: Expr }
  | { k: "let"; name: string; value: Expr; body: Expr };

export const num = (v: number): Expr => ({ k: "num", v });
export const ref = (name: string): Expr => ({ k: "var", name });

const isNum = (e: Expr, v?: number): e is { k: "num"; v: number } =>
  e.k === "num" && (v === undefined || e.v === v);

// Light constant folding keeps generated code and formulas readable.
export function add(a: Expr, b: Expr): Expr {
  if (isNum(a) && isNum(b)) return num(a.v + b.v);
  if (isNum(a, 0)) return b;
  if (isNum(b, 0)) return a;
  return { k: "bin", op: "+", a, b };
}
export function sub(a: Expr, b: Expr): Expr {
  if (isNum(a) && isNum(b)) return num(a.v - b.v);
  if (isNum(b, 0)) return a;
  if (isNum(a, 0)) return neg(b);
  return { k: "bin", op: "-", a, b };
}
export function mul(a: Expr, b: Expr): Expr {
  if (isNum(a) && isNum(b)) return num(a.v * b.v);
  if (isNum(a, 0) || isNum(b, 0)) return num(0);
  if (isNum(a, 1)) return b;
  if (isNum(b, 1)) return a;
  return { k: "bin", op: "*", a, b };
}
export function div(a: Expr, b: Expr): Expr {
  if (isNum(a) && isNum(b) && b.v !== 0) return num(a.v / b.v);
  if (isNum(b, 1)) return a;
  return { k: "bin", op: "/", a, b };
}
export function neg(a: Expr): Expr {
  if (isNum(a)) return num(-a.v);
  if (a.k === "neg") return a.a;
  return { k: "neg", a };
}
// Fold calls whose arguments are all constants using the exact operations
// the CPU backend would run, so results stay bit-identical.
function foldFn(f: Fn, a: number[]): number {
  switch (f) {
    case "cos":
      return Math.cos(a[0]);
    case "sin":
      return Math.sin(a[0]);
    case "exp":
      return Math.exp(a[0]);
    case "abs":
      return Math.abs(a[0]);
    case "floor":
      return Math.floor(a[0]);
    case "acos":
      return Math.acos(a[0]);
    case "atan2":
      return Math.atan2(a[0], a[1]);
    case "sqrt":
      return Math.sqrt(a[0]);
    case "pow":
      return Math.pow(a[0], a[1]);
    case "smask":
      return Math.exp(-Math.exp(-a[1] * a[0]));
    case "tri":
      return Math.acos(Math.cos(a[0])) / Math.PI;
  }
}

export const fn = (f: Fn, ...args: Expr[]): Expr => {
  if (args.every((x) => x.k === "num")) return num(foldFn(f, args.map((x) => (x as { v: number }).v)));
  return { k: "fn", fn: f, args };
};

// Replace a variable by a constant, re-folding on the way up.
export function substitute(e: Expr, name: string, value: number): Expr {
  switch (e.k) {
    case "num":
      return e;
    case "var":
      return e.name === name ? num(value) : e;
    case "neg":
      return neg(substitute(e.a, name, value));
    case "bin": {
      const a = substitute(e.a, name, value);
      const b = substitute(e.b, name, value);
      return e.op === "+" ? add(a, b) : e.op === "-" ? sub(a, b) : e.op === "*" ? mul(a, b) : div(a, b);
    }
    case "fn":
      return fn(e.fn, ...e.args.map((x) => substitute(x, name, value)));
    case "sum":
      return e.v === name ? e : { ...e, body: substitute(e.body, name, value) };
    case "let":
      return { ...e, value: substitute(e.value, name, value), body: substitute(e.body, name, value) };
  }
}
export const cos = (a: Expr) => fn("cos", a);
export const sin = (a: Expr) => fn("sin", a);
export const exp = (a: Expr) => fn("exp", a);
export const abs = (a: Expr) => fn("abs", a);
export const floor = (a: Expr) => fn("floor", a);
export const acos = (a: Expr) => fn("acos", a);
export const atan2 = (y: Expr, x: Expr) => fn("atan2", y, x);
export const sqrt = (a: Expr) => fn("sqrt", a);
export const pow = (a: Expr, b: Expr) => fn("pow", a, b);
// smask(g, k) = exp(-exp(-k g)): 1 where g > 0, 0 where g < 0.
export const smask = (g: Expr, k: Expr) => fn("smask", g, k);
// tri(t) = arccos(cos(t)) / pi: triangle wave in [0, 1] with period 2 pi.
export const tri = (t: Expr) => fn("tri", t);
export const sum = (v: string, from: number, to: number, body: Expr): Expr => ({
  k: "sum",
  v,
  from,
  to,
  body
});
export const let_ = (name: string, value: Expr, body: Expr): Expr => ({
  k: "let",
  name,
  value,
  body
});

export const sq = (a: Expr) => mul(a, a);

// A layer group is a loop over instance index `s`; each instance has a mask
// and three channel intensities. Groups occlude in order, nearest first.
export interface LayerGroup {
  name: string;
  count: number;
  loopVar: string;
  // Definitions evaluated per instance, in order, then referenced by name.
  defs: { name: string; value: Expr }[];
  mask: Expr;
  color: [Expr, Expr, Expr];
  // Instances with |u| or |v| beyond `bound` have a mask of exactly zero
  // and can be skipped without changing any output bit.
  cull?: { u: string; v: string; bound: number };
}

export interface Program {
  // Definitions evaluated once per pixel before layers (noise fields etc.).
  defs: { name: string; value: Expr }[];
  groups: LayerGroup[];
  background: [Expr, Expr, Expr];
  // Coordinate mapping constants.
  view: { scale: number; cx: number; cy: number };
}
