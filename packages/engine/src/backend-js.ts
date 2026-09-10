import { Expr, Program, substitute } from "./ir";

// Sums up to this length are unrolled with constants folded per term.
const UNROLL_LIMIT = 32;

// Yeganeh's clamp: floor(255 e^{-e^{-1000t}} |t|^{e^{-e^{1000(t-1)}}}).
export const CLAMP_JS =
  "function F(t){return Math.floor(255*Math.exp(-Math.exp(-1000*t))*Math.pow(Math.abs(t),Math.exp(-Math.exp(1000*(t-1)))));}";

class JsEmitter {
  private blocks: string[][] = [[]];
  private counter = 0;

  private cur() {
    return this.blocks[this.blocks.length - 1];
  }
  fresh(base: string) {
    return `${base}${this.counter++}`;
  }
  stmt(s: string) {
    this.cur().push(s);
  }
  push() {
    this.blocks.push([]);
  }
  pop(): string[] {
    return this.blocks.pop()!;
  }
  lines(): string[] {
    return this.blocks[0];
  }

  emit(e: Expr): string {
    switch (e.k) {
      case "num":
        return numLit(e.v);
      case "var":
        return e.name;
      case "neg":
        return `(-${this.emit(e.a)})`;
      case "bin":
        return `(${this.emit(e.a)}${e.op}${this.emit(e.b)})`;
      case "fn": {
        const a = e.args.map((x) => this.emit(x));
        switch (e.fn) {
          case "smask":
            return `Math.exp(-Math.exp(-(${a[1]})*(${a[0]})))`;
          case "tri":
            return `(Math.acos(Math.cos(${a[0]}))/Math.PI)`;
          default:
            return `Math.${e.fn}(${a.join(",")})`;
        }
      }
      case "let": {
        this.stmt(`const ${e.name}=${this.emit(e.value)};`);
        return this.emit(e.body);
      }
      case "sum": {
        const acc = this.fresh("acc");
        this.stmt(`let ${acc}=0;`);
        if (e.to - e.from < UNROLL_LIMIT) {
          for (let i = e.from; i <= e.to; i++) {
            this.stmt(`${acc}+=${this.emit(substitute(e.body, e.v, i))};`);
          }
          return acc;
        }
        this.push();
        const body = this.emit(e.body);
        const inner = this.pop();
        this.stmt(`for(let ${e.v}=${e.from};${e.v}<=${e.to};${e.v}++){${inner.join("")}${acc}+=${body};}`);
        return acc;
      }
    }
  }
}

function numLit(v: number): string {
  if (Number.isInteger(v)) return v < 0 ? `(${v})` : `${v}`;
  const s = String(v);
  return v < 0 ? `(${s})` : s;
}

export type PixelFn = (x: number, y: number, out: number[]) => void;

// Names that vary per pixel; anything depending only on the loop index
// can be computed once per instance and looked up in a table.
function dependsOn(e: Expr, names: Set<string>): boolean {
  switch (e.k) {
    case "num":
      return false;
    case "var":
      return names.has(e.name);
    case "neg":
      return dependsOn(e.a, names);
    case "bin":
      return dependsOn(e.a, names) || dependsOn(e.b, names);
    case "fn":
      return e.args.some((a) => dependsOn(a, names));
    case "sum":
      return dependsOn(e.body, names);
    case "let":
      return dependsOn(e.value, names) || dependsOn(e.body, names);
  }
}

// Generate the per-pixel JS source for a compiled program.
export function programToJs(p: Program): string {
  const setup = new JsEmitter();
  const em = new JsEmitter();
  for (const d of p.defs) em.stmt(`const ${d.name}=${em.emit(d.value)};`);
  em.stmt("let U=1,A0=0,A1=0,A2=0;");
  p.groups.forEach((g, gi) => {
    const dyn = new Set(["x", "y", ...p.defs.map((d) => d.name)]);
    const hoisted: string[] = [];
    setup.push();
    em.push();
    for (const d of g.defs) {
      if (dependsOn(d.value, dyn)) {
        dyn.add(d.name);
        em.stmt(`const ${d.name}=${em.emit(d.value)};`);
        if (g.cull && d.name === g.cull.v) {
          em.stmt(`if(Math.abs(${g.cull.u})>${g.cull.bound}||Math.abs(${g.cull.v})>${g.cull.bound})continue;`);
        }
      } else {
        hoisted.push(d.name);
        setup.stmt(`const ${d.name}=${setup.emit(d.value)};${d.name}_t${gi}[${g.loopVar}]=${d.name};`);
        em.stmt(`const ${d.name}=${d.name}_t${gi}[${g.loopVar}];`);
      }
    }
    const m = em.emit(g.mask);
    const c = g.color.map((e) => em.emit(e));
    em.stmt(`const UM=U*${m};A0+=UM*${c[0]};A1+=UM*${c[1]};A2+=UM*${c[2]};U-=UM;`);
    const inner = em.pop();
    const pre = setup.pop();
    for (const h of hoisted) setup.stmt(`const ${h}_t${gi}=new Float64Array(${g.count});`);
    if (hoisted.length > 0) {
      setup.stmt(`for(let ${g.loopVar}=0;${g.loopVar}<${g.count};${g.loopVar}++){${pre.join("\n")}}`);
    }
    em.stmt(`for(let ${g.loopVar}=0;${g.loopVar}<${g.count};${g.loopVar}++){${inner.join("\n")}}`);
  });
  const b = p.background.map((e) => em.emit(e));
  em.stmt(`out[0]=F(A0+U*${b[0]});out[1]=F(A1+U*${b[1]});out[2]=F(A2+U*${b[2]});`);
  return `${CLAMP_JS}\n${setup.lines().join("\n")}\nreturn function(x,y,out){\n${em.lines().join("\n")}\n};`;
}

export function programToPixelFn(p: Program): PixelFn {
  const src = programToJs(p);
  return new Function(src)() as PixelFn;
}
