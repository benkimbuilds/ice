import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human Impact Project",
  description:
    "A living database documenting reported incidents of harm related to U.S. Immigration and Customs Enforcement operations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="bg-warm-900 text-white">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <a href="/" className="block">
              <h1 className="text-4xl font-bold tracking-tight font-serif">
                Human Impact Project
              </h1>
              <p className="text-warm-400 mt-2 text-base leading-relaxed max-w-3xl">
                A living database documenting reported incidents of harm related
                to U.S. Immigration and Customs Enforcement operations.
              </p>
            </a>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-warm-200 mt-16">
          <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-warm-400">
            Data sourced from public reporting.
          </div>
        </footer>
      </body>
    </html>
  );
}
