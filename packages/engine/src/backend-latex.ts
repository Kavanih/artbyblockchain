import { Expr, Program } from "./ir";
import { Params, instanceCount } from "./schema";
import { compile } from "./compile";

// Precedence: 0 add/sub, 1 mul/div, 2 unary, 3 atom
function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const r = Math.round(v * 1e6) / 1e6;
  return String(r);
}

const SYMBOLS: Record<string, string> = {
  rho: "\\rho",
  theta: "\\theta",
  phi: "\\varphi",
  cphi: "\\cos\\varphi",
  sphi: "\\sin\\varphi",
  cx: "c^{x}",
  cy: "c^{y}",
  u: "u",
  v: "v",
  M: "M",
  st: "\\sigma",
  E: "E",
  E_bg: "E_{\\mathrm{bg}}",
  k: "k",
  j: "j",
  i: "i",
  a: "\\alpha",
  t: "t",
  x: "x",
  y: "y",
  s: "s"
};

// Names like rho_3 become \rho_{3}; loop-dependent names get an (s) hint.
export function latexName(name: string): string {
  if (SYMBOLS[name]) return SYMBOLS[name];
  const m = name.match(/^([A-Za-z]+)_(\d+)$/);
  if (m) {
    const base = SYMBOLS[m[1]] ?? m[1];
    return `${base}_{${m[2]}}`;
  }
  return `\\mathrm{${name}}`;
}

function coord(offset: number, scale: number, numer: string): string {
  const frac = `\\frac{${numer}}{\\min(W,H)}`;
  const scaled = scale === 1 ? frac : `${fmtNum(scale)}\\,${frac}`;
  return offset === 0 ? scaled : `${fmtNum(offset)} + ${scaled}`;
}

function paren(s: string, need: boolean) {
  return need ? `\\left(${s}\\right)` : s;
}

export function exprToLatex(e: Expr, prec = 0): string {
  switch (e.k) {
    case "num": {
      const s = fmtNum(e.v);
      return e.v < 0 ? paren(s, prec > 0) : s;
    }
    case "var":
      return latexName(e.name);
    case "neg":
      return paren(`-${exprToLatex(e.a, 2)}`, prec > 1);
    case "bin": {
      if (e.op === "/") return `\\frac{${exprToLatex(e.a, 0)}}{${exprToLatex(e.b, 0)}}`;
      if (e.op === "*") {
        const a = exprToLatex(e.a, 1);
        const b = exprToLatex(e.b, 1);
        const sep = /^[0-9]/.test(b) ? " \\cdot " : " \\, ";
        return paren(`${a}${sep}${b}`, prec > 1);
      }
      const a = exprToLatex(e.a, 0);
      const b = exprToLatex(e.b, e.op === "-" ? 1 : 0);
      return paren(`${a} ${e.op} ${b}`, prec > 0);
    }
    case "fn": {
      const a = e.args;
      switch (e.fn) {
        case "cos":
        case "sin":
        case "exp":
        case "floor":
        case "sqrt":
        case "abs": {
          const inner = exprToLatex(a[0], 0);
          if (e.fn === "abs") return `\\left|${inner}\\right|`;
          if (e.fn === "floor") return `\\left\\lfloor ${inner} \\right\\rfloor`;
          if (e.fn === "sqrt") return `\\sqrt{${inner}}`;
          if (e.fn === "exp") return `e^{${inner}}`;
          return `\\${e.fn}\\left(${inner}\\right)`;
        }
        case "acos":
          return `\\arccos\\left(${exprToLatex(a[0], 0)}\\right)`;
        case "atan2":
          return `\\operatorname{atan2}\\left(${exprToLatex(a[0], 0)}, ${exprToLatex(a[1], 0)}\\right)`;
        case "pow":
          return `${paren(exprToLatex(a[0], 3), a[0].k !== "var" && a[0].k !== "num" && !(a[0].k === "fn" && a[0].fn === "abs"))}^{${exprToLatex(a[1], 0)}}`;
        case "smask":
          return `S_{${exprToLatex(a[1], 0)}}\\left(${exprToLatex(a[0], 0)}\\right)`;
        case "tri":
          return `\\Lambda\\left(${exprToLatex(a[0], 0)}\\right)`;
      }
      return "";
    }
    case "sum":
      return paren(`\\sum_{${e.v}=${e.from}}^{${e.to}} ${exprToLatex(e.body, 1)}`, prec > 0);
    case "let":
      return exprToLatex(e.body, prec);
  }
}

export interface LatexLine {
  label: string;
  latex: string;
}

export interface LatexDoc {
  preamble: LatexLine[];
  fields: LatexLine[];
  layers: { name: string; count: number; lines: LatexLine[] }[];
  composite: LatexLine[];
}

// Full readable formula for a parameter set, in Yeganeh's notation.
export function paramsToLatex(p: Params): LatexDoc {
  const prog: Program = compile(p);
  const v = prog.view;
  const preamble: LatexLine[] = [
    {
      label: "Pixel colour",
      latex:
        "\\text{colour}(m,n) = \\big(F(C_0(x,y)),\\, F(C_1(x,y)),\\, F(C_2(x,y))\\big),\\quad 0 \\le m < W,\; 0 \\le n < H"
    },
    {
      label: "Plane coordinates",
      latex: `x = ${coord(v.cx, v.scale, "2m + 1 - W")},\\qquad y = ${coord(v.cy, v.scale, "H - 2n - 1")}`
    },
    {
      label: "Clamp",
      latex: "F(t) = \\left\\lfloor 255\\, e^{-e^{-1000 t}}\\, |t|^{\\,e^{-e^{1000 (t-1)}}} \\right\\rfloor"
    },
    { label: "Step mask", latex: "S_{k}(g) = e^{-e^{-k g}}" },
    { label: "Triangle wave", latex: "\\Lambda(t) = \\frac{\\arccos(\\cos t)}{\\pi}" }
  ];
  const fields: LatexLine[] = prog.defs.map((d) => ({
    label: d.name,
    latex: `${latexName(d.name)} = ${exprToLatex(d.value)}`
  }));
  const layers = prog.groups.map((g, gi) => {
    const lines: LatexLine[] = g.defs.map((d) => ({
      label: d.name,
      latex: `${latexName(d.name)} = ${exprToLatex(d.value)}`
    }));
    g.color.forEach((c, ci) => {
      lines.push({ label: `W_${ci}_${gi}`, latex: `W_{${ci},${gi}} = ${exprToLatex(c)}` });
    });
    return { name: g.name, count: g.count, lines };
  });
  const L = prog.groups.length;
  const composite: LatexLine[] = [
    {
      label: "Background",
      latex: `B_0 = ${exprToLatex(prog.background[0])},\\quad B_1 = ${exprToLatex(prog.background[1])},\\quad B_2 = ${exprToLatex(prog.background[2])}`
    },
    {
      label: "Occlusion",
      latex:
        "U_{\\ell,s} = \\prod_{(\\ell',s') \\prec (\\ell,s)} \\big(1 - M_{\\ell'}(s')\\big),\\qquad U_{\\infty} = \\prod_{\\ell=0}^{" +
        (L - 1) +
        "} \\prod_{s=0}^{N_\\ell - 1} \\big(1 - M_{\\ell}(s)\\big)"
    },
    {
      label: "Composite",
      latex: `C_v = \\sum_{\\ell=0}^{${L - 1}} \\sum_{s=0}^{N_\\ell - 1} U_{\\ell,s}\\, M_{\\ell}(s)\\, W_{v,\\ell}(s) + U_{\\infty}\\, B_v,\\qquad N = (${prog.groups.map((g) => g.count).join(", ")})`
    }
  ];
  return { preamble, fields, layers, composite };
}

export function latexDocToString(doc: LatexDoc): string {
  const all = [...doc.preamble, ...doc.fields, ...doc.layers.flatMap((l) => l.lines), ...doc.composite];
  return all.map((l) => l.latex).join("\n");
}

export { instanceCount };
