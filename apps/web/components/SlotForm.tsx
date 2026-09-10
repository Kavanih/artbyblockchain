"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SlotForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/block?slot=${encodeURIComponent(value.trim())}`);
      }}
    >
      <input
        name="slot"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Slot number"
        className="w-56 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
        data-testid="slot-input"
      />
      <button type="submit" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-black">
        Render
      </button>
      <button
        type="button"
        className="rounded-md border border-[var(--line)] px-4 py-2"
        onClick={() => {
          setValue("genesis");
          router.push("/block?slot=genesis");
        }}
      >
        Genesis (slot 0)
      </button>
    </form>
  );
}
