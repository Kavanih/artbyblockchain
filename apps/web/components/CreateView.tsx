"use client";

import { useMemo, useState } from "react";
import { Params, paramsToLatex, presets, safeParseParams } from "@slotart/engine";
import { FormulaCanvas } from "./FormulaCanvas";
import { Formula } from "./Formula";
import { ParamEditor } from "./ParamEditor";
import { MintPanel } from "./MintPanel";

const MAX_IMAGE_EDGE = 768;
const MAX_PROMPT = 140;

// Downscale an uploaded image to a JPEG data URL for vision input.
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function CreateView() {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error"; msg?: string }>({ kind: "idle" });
  const [params, setParams] = useState<Params | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [tab, setTab] = useState<"sliders" | "json" | "formula">("sliders");
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const doc = useMemo(() => (params ? paramsToLatex(params) : null), [params]);

  async function generate() {
    setStatus({ kind: "busy" });
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, text: text || undefined, imageDataUrl: mode === "image" ? imageUrl : undefined })
    });
    const json = (await res.json()) as { params?: Params; error?: string; attempts?: number; model?: string; mock?: boolean };
    if (!res.ok || !json.params) {
      setStatus({ kind: "error", msg: json.error ?? `HTTP ${res.status}` });
      return;
    }
    setParams(json.params);
    setJsonDraft(JSON.stringify(json.params, null, 2));
    setMeta(`${json.mock ? "mock model" : json.model}, ${json.attempts} attempt${json.attempts === 1 ? "" : "s"}`);
    setStatus({ kind: "idle" });
  }

  function update(p: Params) {
    setParams(p);
    setJsonDraft(JSON.stringify(p, null, 2));
  }

  function applyJson() {
    try {
      const parsed = safeParseParams(JSON.parse(jsonDraft));
      if (!parsed.ok) throw new Error(parsed.error);
      setParams(parsed.params);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel-soft space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--line-soft)]">
          {(["text", "image"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative px-4 py-2 text-sm transition-colors ${
                mode === m ? "text-[var(--accent-ink)]" : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              data-testid={`mode-${m}`}
            >
              {m === "text" ? "Describe it" : "Upload an image"}
              {mode === m && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--accent)]" />}
            </button>
          ))}
          <button
            onClick={() => update(presets.flower)}
            className="ml-auto rounded border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--panel)]"
            data-testid="load-preset"
          >
            Load a preset instead
          </button>
        </div>
        {mode === "image" && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              data-testid="image-input"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImageUrl(await fileToDataUrl(f));
              }}
              className="text-sm text-[var(--muted)]"
            />
            {imageUrl && <img src={imageUrl} alt="upload preview" className="h-24 rounded border border-[var(--line)]" />}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_PROMPT))}
          placeholder={mode === "text" ? "A field of orange poppies under a cloudy evening sky" : "Optional guidance for the model"}
          className="h-24 w-full resize-none rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm focus:border-[var(--accent)] focus:outline-none"
          data-testid="description"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generate}
            disabled={status.kind === "busy" || (mode === "text" ? !text.trim() : !imageUrl)}
            className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            data-testid="generate"
          >
            {status.kind === "busy" ? "Generating" : "Generate"}
          </button>
          {meta && <span className="text-xs text-[var(--muted)]">{meta}</span>}
          {status.kind === "error" && <span className="text-sm text-red-600" data-testid="generate-error">{status.msg}</span>}
        </div>
      </div>

      {params && doc && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="hero-frame panel-soft overflow-hidden">
              <FormulaCanvas params={params} width={768} height={768} className="block w-full" />
            </div>
            <div className="font-serif text-lg font-medium">{params.title}</div>
            <MintPanel kind="custom" params={params} />
          </div>
          <div className="panel p-5">
            <div className="mb-4 flex gap-1 border-b border-[var(--line-soft)]">
              {(["sliders", "json", "formula"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative px-3 py-2 text-sm transition-colors ${
                    tab === t ? "text-[var(--accent-ink)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {t === "sliders" ? "Sliders" : t === "json" ? "Parameters" : "Formula"}
                  {tab === t && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--accent)]" />}
                </button>
              ))}
            </div>
            <div className="max-h-[78vh] overflow-auto">
              {tab === "sliders" && <ParamEditor params={params} onChange={update} />}
              {tab === "json" && (
                <div className="space-y-2">
                  <textarea
                    value={jsonDraft}
                    onChange={(e) => setJsonDraft(e.target.value)}
                    className="h-[60vh] w-full resize-none rounded border border-[var(--line)] bg-[var(--panel-soft)] p-3 font-mono text-xs focus:border-[var(--accent)] focus:outline-none"
                    data-testid="params-json"
                  />
                  <button onClick={applyJson} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[var(--panel-soft)]">
                    Apply JSON
                  </button>
                  {jsonError && <div className="text-xs text-red-600">{jsonError}</div>}
                </div>
              )}
              {tab === "formula" && <Formula doc={doc} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
