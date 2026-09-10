"use client";

import katex from "katex";
import { useMemo, useState } from "react";
import type { LatexDoc, LatexLine } from "@slotart/engine";

function Line({ line }: { line: LatexLine }) {
  const html = useMemo(
    () => katex.renderToString(line.latex, { displayMode: true, throwOnError: false, strict: false }),
    [line.latex]
  );
  return <div className="formula-line" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Renders the full expanded formula grouped by section, using KaTeX.
export function Formula({ doc }: { doc: LatexDoc }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ preamble: true, fields: true, composite: true });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const Section = ({ id, title, lines }: { id: string; title: string; lines: LatexLine[] }) => (
    <div className="mb-3">
      <button onClick={() => toggle(id)} className="mb-1 text-sm font-medium text-[var(--accent)]">
        {open[id] ? "Hide" : "Show"} {title} ({lines.length})
      </button>
      {open[id] && lines.map((l, i) => <Line key={i} line={l} />)}
    </div>
  );
  return (
    <div className="text-sm">
      <Section id="preamble" title="definitions" lines={doc.preamble} />
      <Section id="fields" title="fields" lines={doc.fields} />
      {doc.layers.map((l, i) => (
        <Section key={i} id={`layer${i}`} title={`layer ${i} (${l.name}, N = ${l.count})`} lines={l.lines} />
      ))}
      <Section id="composite" title="composite" lines={doc.composite} />
    </div>
  );
}
