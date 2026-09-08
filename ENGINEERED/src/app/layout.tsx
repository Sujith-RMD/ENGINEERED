import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENGINEERED — 150 Seconds. One System. Infinite Consequences.",
  description:
    "A 150-second engineering simulation: take command of a failing system, make trade-offs under pressure, survive the crisis, and see the decade your decisions created.",
  applicationName: "ENGINEERED",
};

export const viewport: Viewport = {
  themeColor: "#04060b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
