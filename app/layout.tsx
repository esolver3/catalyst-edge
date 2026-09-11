import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catalyst Edge | Explainable Crypto Market Signals",
  description:
    "Live CoinMarketCap data transformed into ranked, explainable crypto research setups with transparent risk levels.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
