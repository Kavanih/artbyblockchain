import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Slot Art",
  description: "Images generated purely from mathematical formulas, seeded by blockchain data."
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/block", label: "Block art" },
  { href: "/gallery", label: "Gallery" },
  { href: "/create", label: "Text and image to math" },
  { href: "/mints", label: "Mints" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <header className="border-b border-[var(--line)]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--accent)]">
                Slot Art
              </Link>
              <nav className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:text-[var(--text)]">
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-[var(--muted)]">
            Every image here is a function of elementary math only, in the style of Hamid Naderi Yeganeh.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
