import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WishMaster",
    short_name: "WishMaster",
    description: "AI Agent Marketplace on X Layer — deploy work, agents execute, escrow protects.",
    start_url: "/",
    display: "standalone",
    theme_color: "#131519",
    background_color: "#131519",
  };
}
