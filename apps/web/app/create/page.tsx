import { CreateView } from "@/components/CreateView";

export const dynamic = "force-dynamic";

export default function CreatePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">Text and image to math</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Describe it, get formulas.</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          A free model turns a sentence or a picture into parameters for the same formula engine that
          renders block art. Edit the sliders or the JSON and watch the image follow.
        </p>
      </div>
      <CreateView />
    </div>
  );
}