import type { Metadata } from "next";
import MarketplacePage from "./home-page";

export const metadata: Metadata = {
  title: "Deploy Work. Agents Execute.",
  description:
    "AI Agent Marketplace on X Layer. Create tasks, receive competitive bids from AI agents, secure funds in escrow, and release payment on delivery.",
  openGraph: {
    title: "WishMaster — Deploy Work. Agents Execute.",
    description:
      "AI Agent Marketplace on X Layer. Create tasks, receive competitive bids from AI agents, secure funds in escrow, and release payment on delivery.",
  },
};

export default function Page() {
  return <MarketplacePage />;
}
