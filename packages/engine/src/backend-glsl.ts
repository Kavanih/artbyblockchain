import { Expr, Program } from "./ir";

// GLSL preview backend. Same structure as the CPU path; float32 precision
// means GPU output is a preview, the CPU render is canonical.
class GlslEmitter {
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
  pop() {
    return this.blocks.pop()!;
  }
  lines() {
    return this.blocks[0];
  }
  emit(e: Expr): string {
    switch (e.k) {
      case "num":
        return glslNum(e.v);
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
            return `exp(-exp(min(-(${a[1]})*(${a[0]}),60.0)))`;
          case "tri":
            return `(acos(clamp(cos(${a[0]}),-1.0,1.0))/3.141592653589793)`;
          case "pow":
            return `pow(max(${a[0]},0.0),${a[1]})`;
          case "atan2":
            return `atan(${a[0]},${a[1]})`;
          case "acos":
            return `acos(clamp(${a[0]},-1.0,1.0))`;
          default:
            return `${e.fn}(${a.join(",")})`;
        }
      }
      case "let": {
        this.stmt(`float ${e.name}=${this.emit(e.value)};`);
        return this.emit(e.body);
      }
      case "sum": {
        const acc = this.fresh("acc");
        this.stmt(`float ${acc}=0.0;`);
        this.push();
        const body = this.emit(e.body);
        const inner = this.pop();
        this.stmt(
          `for(int ${e.v}_i=${e.from};${e.v}_i<=${e.to};${e.v}_i++){float ${e.v}=float(${e.v}_i);${inner.join("")}${acc}+=${body};}`
        );
        return acc;
      }
    }
  }
}

function glslNum(v: number): string {
  let s = Number.isInteger(v) ? `${v}.0` : String(v);
  if (s.includes("e")) s = v.toFixed(12);
  return v < 0 ? `(${s})` : s;
}

export function programToGlsl(p: Program): string {
  const em = new GlslEmitter();
  for (const d of p.defs) em.stmt(`float ${d.name}=${em.emit(d.value)};`);
  em.stmt("float U=1.0;vec3 A=vec3(0.0);");
  for (const g of p.groups) {
    em.push();
    for (const d of g.defs) em.stmt(`float ${d.name}=${em.emit(d.value)};`);
    const m = em.emit(g.mask);
    const c = g.color.map((e) => em.emit(e));
    em.stmt(`float UM=U*${m};A+=UM*vec3(${c[0]},${c[1]},${c[2]});U-=UM;`);
    const inner = em.pop();
    em.stmt(`for(int ${g.loopVar}_i=0;${g.loopVar}_i<${g.count};${g.loopVar}_i++){float ${g.loopVar}=float(${g.loopVar}_i);${inner.join("\n")}}`);
  }
  const b = p.background.map((e) => em.emit(e));
  em.stmt(`vec3 C=A+U*vec3(${b[0]},${b[1]},${b[2]});`);
  const v = p.view;
  return `#version 300 es
precision highp float;
uniform vec2 u_resolution;
out vec4 fragColor;
float F(float t){return floor(255.0*clamp(t,0.0,1.0))/255.0;}
void main(){
float half_=min(u_resolution.x,u_resolution.y)*0.5;
float x=${glslNum(v.cx)}+${glslNum(v.scale)}*(gl_FragCoord.x-u_resolution.x*0.5)/half_;
float y=${glslNum(v.cy)}+${glslNum(v.scale)}*(gl_FragCoord.y-u_resolution.y*0.5)/half_;
${em.lines().join("\n")}
fragColor=vec4(F(C.r),F(C.g),F(C.b),1.0);
}
`;
}
