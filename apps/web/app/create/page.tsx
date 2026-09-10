import { CreateView } from "@/components/CreateView";

export default function CreatePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Text and image to math</h1>
        <p className="max-w-3xl text-[var(--muted)]">
          A language model translates your description or picture into parameters for the formula engine. It never
          writes formulas itself; the engine composes them. Results are stylised compositions of smooth shapes, stripes
          and noise, not photoreal reproductions. Tweak any parameter and the image re-renders live.
        </p>
      </div>
      <CreateView />
    </div>
  );
}
