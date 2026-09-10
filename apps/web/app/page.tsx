import Link from "next/link";
import { presets, presetNames } from "@slotart/engine";
import { FormulaCanvas } from "@/components/FormulaCanvas";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Images made of nothing but formulas</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Each pixel colour is the value of an explicit expression in x and y built from cosines, exponentials and
          absolute values. Block art derives every constant from Solana block data. The create page turns text or an
          image into parameters for the same engine.
        </p>
        <div className="flex gap-3 text-sm">
          <Link href="/block?slot=0" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-black">
            Render the genesis block
          </Link>
          <Link href="/create" className="rounded-md border border-[var(--line)] px-4 py-2">
            Create from text or image
          </Link>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-medium">Engine presets</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {presetNames.map((name) => (
            <div key={name} className="panel overflow-hidden">
              <FormulaCanvas params={presets[name]} width={360} height={360} className="w-full" />
              <div className="px-3 py-2 text-sm">
                <div className="font-medium">{presets[name].title}</div>
                <div className="text-[var(--muted)]">{presets[name].layers.length} layers</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
