"use client";

import type { Params } from "@slotart/engine";

// Slider ranges keyed by leaf name; unknown numeric leaves are not editable.
const RANGES: Record<string, [number, number, number]> = {
  scale: [0.1, 10, 0.01],
  cx: [-4, 4, 0.01],
  cy: [-4, 4, 0.01],
  seed: [0, 1000, 1],
  octaves: [1, 16, 1],
  frequency: [0.1, 60, 0.1],
  amplitude: [-1, 1, 0.01],
  threshold: [-1, 1, 0.01],
  gain: [0, 8, 0.05],
  squareness: [0.5, 8, 0.05],
  count: [1, 64, 1],
  depth: [0, 1, 0.01],
  ringWidth: [0.02, 1, 0.01],
  cols: [1, 24, 1],
  rows: [1, 16, 1],
  perspective: [0, 3, 0.01],
  depthFade: [0, 1, 0.01],
  stagger: [0, 1, 0.01],
  jitter: [0, 1, 0.01],
  radius: [0, 4, 0.01],
  phase: [-7, 7, 0.01],
  sizeJitter: [0, 1, 0.01],
  shrink: [0, 0.2, 0.001],
  rotation: [-7, 7, 0.01],
  softness: [5, 2000, 5],
  angle: [-7, 7, 0.01],
  contrast: [-1, 1, 0.01]
};
const TUPLES: Record<string, [number, number, number]> = {
  top: [0, 1, 0.005],
  bottom: [0, 1, 0.005],
  color: [0, 1, 0.005],
  edge: [0, 1, 0.005],
  center: [-4, 4, 0.01],
  size: [0.005, 8, 0.005],
  spacing: [-4, 4, 0.01],
  spread: [-4, 4, 0.01]
};

type Path = (string | number)[];

function setAt(obj: unknown, path: Path, value: number): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[head as number] = setAt(obj[head as number], rest, value);
    return copy;
  }
  const o = obj as Record<string, unknown>;
  return { ...o, [head]: setAt(o[head as string], rest, value) };
}

interface Field {
  label: string;
  path: Path;
  value: number;
  range: [number, number, number];
}

function collect(obj: unknown, path: Path, out: Field[], skip: Set<string>) {
  if (obj === null || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (skip.has(k)) continue;
    const p = [...path, k];
    if (typeof v === "number" && RANGES[k]) {
      out.push({ label: p.join("."), path: p, value: v, range: RANGES[k] });
    } else if (Array.isArray(v) && TUPLES[k] && v.every((x) => typeof x === "number")) {
      v.forEach((x, i) => out.push({ label: `${p.join(".")}[${i}]`, path: [...p, i], value: x as number, range: TUPLES[k] }));
    } else if (typeof v === "object" && !Array.isArray(v)) {
      collect(v, p, out, skip);
    }
  }
}

export function ParamEditor({ params, onChange }: { params: Params; onChange: (p: Params) => void }) {
  const sections: { title: string; fields: Field[] }[] = [];
  const skip = new Set(["version", "title", "layers", "name", "kind", "faceOut", "mode"]);
  const global: Field[] = [];
  collect({ seed: params.seed, view: params.view, background: params.background }, [], global, skip);
  sections.push({ title: "Global", fields: global });
  params.layers.forEach((l, i) => {
    const f: Field[] = [];
    collect(l, ["layers", i], f, skip);
    sections.push({ title: `Layer ${i}: ${l.name ?? l.shape.kind}`, fields: f });
  });
  return (
    <div className="space-y-4 text-xs" data-testid="param-editor">
      {sections.map((s) => (
        <details key={s.title} open={s.title === "Global"}>
          <summary className="cursor-pointer text-sm font-medium text-[var(--accent)]">{s.title}</summary>
          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {s.fields.map((f) => (
              <label key={f.label} className="flex items-center gap-2">
                <span className="w-44 truncate text-[var(--muted)]" title={f.label}>
                  {f.label.replace(/^layers\.\d+\./, "").replace(/^background\./, "bg.")}
                </span>
                <input
                  type="range"
                  min={f.range[0]}
                  max={f.range[1]}
                  step={f.range[2]}
                  value={f.value}
                  onChange={(e) => onChange(setAt(params, f.path, Number(e.target.value)) as Params)}
                  className="flex-1"
                />
                <span className="w-12 text-right tabular-nums">{Number.isInteger(f.range[2]) ? f.value : f.value.toFixed(3)}</span>
              </label>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
