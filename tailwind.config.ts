import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0C",
        card: "#151412",
        "card-border": "#3A331F",
        gold: "#C9A227",
        "gold-dim": "#5C4E1E",
        cream: "#EDE7D8",
        muted: "#726C5E",
        danger: "#8C2E2E",
      },
      fontFamily: {
        display: ["var(--font-cinzel)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
