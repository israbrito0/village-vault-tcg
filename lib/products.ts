import catalogo from "./generated/catalogo.json";
import type { Product } from "./types";

export type { Product } from "./types";

// Gerado por scripts/gerar-catalogo.mjs a partir de data/estoque.csv.
// Para mudar produtos, edite a planilha, não este arquivo.
export const PRODUCTS = catalogo.products as Product[];

export function getFeaturedProducts() {
  return PRODUCTS.filter((p) => p.featured);
}

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug);
}

// A Scryfall recusa o otimizador de imagens do Next (bloqueia o User-Agent do
// Node), então essas imagens vão direto do servidor deles para o navegador.
export function loadImageDirectly(src: string) {
  return src.startsWith("https://cards.scryfall.io/");
}

export function formatPriceBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
