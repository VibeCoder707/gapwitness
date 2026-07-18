import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GapWitness | Evidence-backed code validation",
  description: "Prove whether a code change satisfies its written requirements.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
