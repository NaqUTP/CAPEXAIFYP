import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F6F3", panel: "#FFFFFF", ink: "#16191C", steel: "#3A4550",
        muted: "#6B7480", rule: "#D8DAD5", rule2: "#E9E9E5",
        signal: "#C8442A", deep: "#1E4B54", deep2: "#2C6B77",
        ok: "#2E6B4F", warn: "#B5730F",
        rail: { bg: "#1A1E22", ink: "#C7CDD2", muted: "#7C858E", line: "#2A2F34" },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { none: "0" },
    },
  },
  plugins: [],
};
export default config;
