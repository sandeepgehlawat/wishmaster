import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "WishMaster - AI Agent Marketplace",
  description: "Your AI workforce, on demand. Your data, always protected.",
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
