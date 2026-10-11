import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Tema claro: fundo branco, texto grafite e acentos coloridos.
      colors: {
        ink: "#333844", // grafite: texto sobre fundos coloridos e áreas escuras
        card: "#FFFFFF",
        "card-border": "#E6E8EC",
        surface: "#F4F6F8", // cinza bem claro para fundos de destaque
        gold: "#F4AF14", // amarelo da marca: faixa do menu, botões e bordas
        "gold-deep": "#9A6700", // amarelo escuro legível para texto no fundo branco
        "gold-dim": "#F6D27C",
        cream: "#333844", // texto principal
        muted: "#6B7280",
        danger: "#F53A3A",
        // Botões do menu inicial
        "brand-green": "#24A24E",
        "brand-blue": "#158BCA",
        "brand-red": "#F53A3A",
        "brand-yellow": "#F4AF14",
        "brand-yellow-text": "#A87400",
        // Dash Village (/dash): cores por variável, que mudam com o tema claro
        // ou escuro. Em canais RGB para aceitar opacidade (bg-d-gold/15).
        "d-bg": "rgb(var(--d-bg) / <alpha-value>)",
        "d-panel": "rgb(var(--d-panel) / <alpha-value>)",
        "d-panel2": "rgb(var(--d-panel2) / <alpha-value>)",
        "d-line": "rgb(var(--d-line) / <alpha-value>)",
        "d-ink": "rgb(var(--d-ink) / <alpha-value>)",
        "d-ink2": "rgb(var(--d-ink2) / <alpha-value>)",
        "d-ink3": "rgb(var(--d-ink3) / <alpha-value>)",
        "d-brand": "rgb(var(--d-brand) / <alpha-value>)",
        "d-on-brand": "rgb(var(--d-on-brand) / <alpha-value>)",
        "d-gold": "rgb(var(--d-gold) / <alpha-value>)",
        "d-on-gold": "rgb(var(--d-on-gold) / <alpha-value>)",
        "d-ok": "rgb(var(--d-ok) / <alpha-value>)",
        "d-warn": "rgb(var(--d-warn) / <alpha-value>)",
        "d-bad": "rgb(var(--d-bad) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
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
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.95" },
        },
        shimmer: {
          "0%": { transform: "translateX(-130%) skewX(-12deg)" },
          "100%": { transform: "translateX(130%) skewX(-12deg)" },
        },
        heroSway: {
          "0%, 100%": { transform: "scale(1.06) rotate(0deg)" },
          "50%": { transform: "scale(1.09) rotate(-0.5deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        // Vídeo da home "flutuando" inclinado em 3D, com a sombra acompanhando.
        floatTilt: {
          "0%, 100%": { transform: "perspective(1000px) rotateX(10deg) rotateY(-10deg) translateY(0)" },
          "50%": { transform: "perspective(1000px) rotateX(6deg) rotateY(8deg) translateY(-12px)" },
        },
        // Asa do nome da loja batendo em volta do "ombro" (borda interna).
        flap: {
          "0%, 100%": { transform: "rotate(14deg) scaleY(0.88)" },
          "50%": { transform: "rotate(-16deg) scaleY(1.04)" },
        },
        shadowPulse: {
          "0%, 100%": { transform: "scaleX(1)", opacity: "0.35" },
          "50%": { transform: "scaleX(0.82)", opacity: "0.2" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.9s ease-out both",
        "spin-slow": "spinSlow 18s linear infinite",
        "spin-slow-reverse": "spinSlowReverse 24s linear infinite",
        "pulse-gold": "pulseGold 2.2s ease-in-out infinite",
        shimmer: "shimmer 2.8s ease-in-out infinite",
        "hero-sway": "heroSway 8s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
        "float-tilt": "floatTilt 7s ease-in-out infinite",
        "shadow-pulse": "shadowPulse 7s ease-in-out infinite",
        flap: "flap 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
