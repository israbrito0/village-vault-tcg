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
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        spinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        spinSlowReverse: {
          "0%": { transform: "rotate(360deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        pulseGold: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "0.75" },
        },
        shimmer: {
          "0%": { transform: "translateX(-130%) skewX(-12deg)" },
          "100%": { transform: "translateX(130%) skewX(-12deg)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.9s ease-out both",
        "spin-slow": "spinSlow 50s linear infinite",
        "spin-slow-reverse": "spinSlowReverse 65s linear infinite",
        "pulse-gold": "pulseGold 3.2s ease-in-out infinite",
        shimmer: "shimmer 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
