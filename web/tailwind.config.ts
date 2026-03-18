import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    colors: {
      black: "#000",
      white: "#fff",
      muted: "#888",
      transparent: "transparent",
      current: "currentColor",
      // Status colors
      green: {
        400: "#4ade80",
        500: "#22c55e",
      },
      red: {
        400: "#f87171",
        500: "#ef4444",
      },
      yellow: {
        400: "#facc15",
        500: "#eab308",
      },
      blue: {
        400: "#60a5fa",
        500: "#3b82f6",
      },
    },
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "0",
    },
    fontFamily: {
      mono: ['"Space Mono"', "monospace"],
      sans: ['"Space Mono"', "monospace"],
    },
    extend: {
      borderWidth: {
        DEFAULT: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
