// Estilo dos botões contornados coloridos, usado na home e nas páginas internas.
// Fica em components/ para o Tailwind enxergar as classes.

// Sem cor de fundo: cada variante define a sua (senão o bg-white do contorno
// venceria o fundo cheio do botão ativo).
export const BUTTON_BASE =
  "rounded border-2 font-bold uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-colors";

export const ACCENT_BUTTON = {
  green: "border-brand-green/40 bg-white text-brand-green hover:border-brand-green hover:bg-brand-green hover:text-white",
  blue: "border-brand-blue/40 bg-white text-brand-blue hover:border-brand-blue hover:bg-brand-blue hover:text-white",
  red: "border-brand-red/40 bg-white text-brand-red hover:border-brand-red hover:bg-brand-red hover:text-white",
  yellow: "border-brand-yellow/60 bg-white text-brand-yellow-text hover:border-brand-yellow hover:bg-brand-yellow hover:text-ink",
};

// Botão já selecionado (filtro ativo): cheio de cor.
export const ACCENT_ACTIVE = {
  green: "border-brand-green bg-brand-green text-white",
  blue: "border-brand-blue bg-brand-blue text-white",
  red: "border-brand-red bg-brand-red text-white",
  yellow: "border-brand-yellow bg-brand-yellow text-ink",
};

export type Accent = keyof typeof ACCENT_BUTTON;

// Ordem das cores quando uma lista de botões alterna entre elas.
export const ACCENT_CYCLE: Accent[] = ["green", "blue", "red", "yellow"];

export function accentAt(index: number): Accent {
  return ACCENT_CYCLE[index % ACCENT_CYCLE.length];
}
