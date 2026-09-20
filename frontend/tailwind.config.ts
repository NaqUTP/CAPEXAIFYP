import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0E1116", panel: "#171B22", panel2: "#1E232C", elev: "#232A34",
        text: "#E6E9EF", muted: "#8A93A2", dim: "#5B6472",
        teal: "#00A19B", purple: "#6C4DD3",
        ok: "#3FB27F", warn: "#E0A93B", sig: "#E5654B",
      },
      fontFamily: {
        head: ['"Sora"', "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
