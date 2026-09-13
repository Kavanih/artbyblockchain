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
  { href: "/create", label: "Create" },
  { href: "/mints", label: "Mints" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <header className="sticky top-0 z-20 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-x-6 px-4 py-3">
              <Link href="/" className="font-serif text-xl font-medium tracking-tight text-[var(--accent-ink)]">
                Slot Art
              </Link>
              <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] sm:flex">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="transition-colors hover:text-[var(--text)]">
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="sm:hidden">
                <details className="group">
                  <summary className="list-none cursor-pointer text-sm text-[var(--muted)]">
                    <span className="group-open:hidden">Menu</span>
                    <span className="hidden group-open:inline">Close</span>
                  </summary>
                  <div className="absolute right-4 top-12 w-48 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-sm">
                    {NAV.map((n) => (
                      <Link key={n.href} href={n.href} className="block rounded-md px-3 py-2 text-sm hover:bg-[var(--panel-soft)]">
                        {n.label}
                      </Link>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </header>
          <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
            {children}
          </main>
          <footer className="mx-auto max-w-6xl px-4 py-10">
            <div className="rule mb-4" />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <p>
                Every image here is a function of elementary math only, in the style of Hamid Naderi Yeganeh.
              </p>
              <p className="mono">mappingVersion 1</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}