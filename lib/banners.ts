import { PRODUCTS, loadImageDirectly } from "./products";
import type { GameSlug } from "./types";

// Banners em leque da página inicial. Edite aqui textos, cupons e links.
//
// ATENÇÃO: os cupons abaixo são EXEMPLOS. Confirme os códigos e descontos
// reais antes de publicar; o cliente informa o cupom na conversa do WhatsApp.

export type BannerColor = "yellow" | "blue" | "red" | "green" | "ink";

export interface Banner {
  id: string;
  // Com jogo, o banner mostra cartas desse jogo que estão no catálogo.
  game?: GameSlug;
  title: string;
  tagline: string;
  coupon?: string;
  couponText: string;
  cta: string;
  href: string;
  color: BannerColor;
}

export const BANNERS: Banner[] = [
  {
    id: "pokemon",
    game: "pokemon",
    title: "Pokémon TCG",
    tagline: "Cartas avulsas, boosters e coleções especiais.",
    coupon: "POKE10",
    couponText: "10% off em cartas avulsas",
    cta: "Ver Pokémon",
    href: "/catalogo?jogo=pokemon",
    color: "yellow",
  },
  {
    id: "magic",
    game: "magic",
    title: "Magic: The Gathering",
    tagline: "Das edições clássicas aos lançamentos.",
    coupon: "MAGIC10",
    couponText: "10% off na primeira compra",
    cta: "Ver Magic",
    href: "/catalogo?jogo=magic",
    color: "blue",
  },
  {
    id: "yugioh",
    game: "yugioh",
    title: "Yu-Gi-Oh!",
    tagline: "Monte seu deck com cartas verificadas.",
    coupon: "DUELO10",
    couponText: "10% off em cartas avulsas",
    cta: "Ver Yu-Gi-Oh!",
    href: "/catalogo?jogo=yugioh",
    color: "red",
  },
  {
    id: "one-piece",
    game: "one-piece",
    title: "One Piece",
    tagline: "Cartas nacionais e importadas do Japão.",
    coupon: "OP10",
    couponText: "10% off em cartas avulsas",
    cta: "Ver One Piece",
    href: "/catalogo?jogo=one-piece",
    color: "green",
  },
  {
    id: "frete",
    title: "Frete grátis",
    tagline: "E 5% de desconto pagando no Pix.",
    couponText: "12x sem juros no cartão",
    cta: "Ver catálogo",
    href: "/catalogo",
    color: "ink",
  },
];

export type FanBanner = Banner & {
  images: { src: string; alt: string; direct: boolean }[];
};

// Cada banner mostra até duas cartas com foto do jogo dele (ou de qualquer jogo).
export function getFanBanners(): FanBanner[] {
  return BANNERS.map((banner) => ({
    ...banner,
    images: PRODUCTS.filter((p) => p.image && (!banner.game || p.game === banner.game))
      .slice(0, 2)
      .map((p) => ({ src: p.image!, alt: p.name, direct: loadImageDirectly(p.image!) })),
  }));
}
