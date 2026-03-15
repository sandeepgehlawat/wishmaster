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
