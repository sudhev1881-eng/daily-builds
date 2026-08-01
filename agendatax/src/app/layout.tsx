import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://agendatax.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AgendaTax — See the real cost of recurring meetings",
    template: "%s · AgendaTax",
  },
  description:
    "Privacy-first meeting cost calculator. Estimate the annual salary cost of recurring meetings, share scenarios, and export reports — all in your browser.",
  keywords: [
    "meeting cost calculator",
    "meeting tax",
    "productivity",
    "remote work",
    "calendar hygiene",
    "salary cost of meetings",
  ],
  authors: [{ name: "AgendaTax" }],
  openGraph: {
    type: "website",
    title: "AgendaTax — See the real cost of recurring meetings",
    description:
      "Estimate yearly meeting cost from attendee salaries, duration, and frequency. No accounts. Data stays local.",
    url: siteUrl,
    siteName: "AgendaTax",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgendaTax — See the real cost of recurring meetings",
    description:
      "Estimate yearly meeting cost from attendee salaries, duration, and frequency.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${figtree.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
