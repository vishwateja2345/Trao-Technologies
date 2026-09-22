import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

// Archivo: a geometric grotesk with a signage/wayfinding lineage — the body
// and UI face for this build's "departure board" visual world (see
// DESIGN.md). JetBrains Mono carries every data value: schedule days,
// requirement ids, difficulty/minute counts, timestamps — the "flap
// characters" of the board, never decorative prose.
const archivo = Archivo({ variable: "--font-display", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrepKit — Interview Prep Kit",
  description: "Turn a job description into a personalised interview preparation kit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-board text-ink">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
