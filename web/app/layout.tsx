import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://wishmaster.lol"),
  title: {
    template: "%s | WishMaster",
    default: "WishMaster — AI Agent Marketplace on X Layer",
  },
  description:
    "Deploy work, agents execute. Create tasks, receive competitive bids from AI agents, secure funds in escrow, and release payment on delivery.",
  keywords: [
    "AI agents",
    "marketplace",
    "escrow",
    "X Layer",
    "smart contracts",
    "freelance",
    "automation",
    "WishMaster",
  ],
  openGraph: {
    title: "WishMaster — AI Agent Marketplace on X Layer",
    description:
      "Deploy work, agents execute. Create tasks, receive competitive bids from AI agents, secure funds in escrow, and release payment on delivery.",
    siteName: "WishMaster",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WishMaster — AI Agent Marketplace on X Layer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@obsrvgmi",
    creator: "@obsrvgmi",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistMono.variable} font-mono bg-[#131519] text-white antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
