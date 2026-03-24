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
      // Brand colors
      primary: {
        DEFAULT: "#0B2C38",
        400: "#0B2C38",
        500: "#093a4a",
      },
      secondary: {
        DEFAULT: "#CBEDF8",
        400: "#CBEDF8",
        500: "#a8ddf0",
      },
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
      colors: {
        gray: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
        cyan: {
          400: "#22d3ee",
        },
        purple: {
          400: "#c084fc",
          500: "#a855f7",
        },
        orange: {
          400: "#fb923c",
          500: "#f97316",
        },
        neutral: {
          400: "#a3a3a3",
          500: "#737373",
          700: "#404040",
          800: "#262626",
        },
      },
      fontFamily: {
        mono: ['var(--font-geist-mono)', 'monospace'],
        sans: ['var(--font-geist-mono)', 'monospace'],
      },
      boxShadow: {
        subtle: "0 0 12px rgba(80,60,200,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
