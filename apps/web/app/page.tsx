import Link from "next/link";
import { presets, presetNames } from "@slotart/engine";
import { FormulaCanvas } from "@/components/FormulaCanvas";

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
            Generative formula art
          </p>
          <h1 className="font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            Images made of nothing but formulas.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--muted)]">
            Each pixel colour is the value of an explicit expression in x and y built from cosines,
            exponentials and absolute values. Block art derives every constant from Solana block data;
            the create page turns text or an image into parameters for the same engine.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/block?slot=0"
              className="inline-flex items-center rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-ink)]"
            >
              Render the genesis block
            </Link>
            <Link
              href="/create"
              className="inline-flex items-center rounded-md border border-[var(--line)] px-5 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--panel-soft)]"
            >
              Create from text or image
            </Link>
          </div>
        </div>
        <div className="hero-frame panel-soft overflow-hidden">
          <FormulaCanvas params={presets.sky} width={560} height={560} className="block w-full" />
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-medium">Engine presets</h2>
          <span className="text-xs text-[var(--faint)]">three built-in compositions</span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {presetNames.map((name) => (
            <Link key={name} href="/create" className="group panel overflow-hidden transition-shadow hover:shadow-sm">
              <FormulaCanvas params={presets[name]} width={420} height={420} className="block w-full" />
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-serif text-lg font-medium">{presets[name].title}</div>
                  <div className="text-xs text-[var(--muted)]">{presets[name].layers.length} layers</div>
                </div>
                <span className="text-xs text-[var(--faint)] transition-colors group-hover:text-[var(--accent)]">
                  open
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}