import { PRODUCTS, getProductBySlug, loadImageDirectly } from "./products";
import { whatsappLink } from "./site";
import type { GameSlug } from "./types";

// Banners em leque do catálogo e das páginas do menu. Edite aqui textos,
// cupons, fotos e links.
//
// ATENÇÃO: os cupons abaixo são EXEMPLOS. Confirme os códigos e descontos
// reais antes de publicar; o cliente informa o cupom na conversa do WhatsApp.
//
// Foto do produto no banner, de duas formas:
// - `productSlug`: usa a foto e o link de um produto da planilha;
// - `image`: foto própria em public/banners/ (ex.: "/banners/30-anos.jpg").
// Sem foto, o banner mostra cartas do jogo que estão no catálogo.

export type BannerColor = "yellow" | "blue" | "red" | "green" | "ink";

export interface Banner {
  id: string;
  game?: GameSlug;
  // Etiqueta em destaque no topo, ex.: "PRÉ-VENDA", "LANÇAMENTO".
  badge?: string;
  title: string;
  tagline: string;
  coupon?: string;
  couponText: string;
  cta: string;
  // Link do botão. Sem href, o botão abre o WhatsApp com `whatsappMessage`.
  href?: string;
  whatsappMessage?: string;
  productSlug?: string;
  image?: string;
  color: BannerColor;
}

export const BANNERS: Banner[] = [
  {
    id: "pokemon-30-anos",
    game: "pokemon",
    badge: "PRÉ-VENDA",
    title: "Celebrações 30 anos",
    tagline: "Reserve o seu antes do lançamento.",
    couponText: "Reserva pelo WhatsApp",
    cta: "Quero reservar",
    whatsappMessage: "Olá! Quero reservar na pré-venda: Pokémon Celebrações 30 anos.",
    // image: "/banners/pokemon-30-anos.jpg",  ← coloque a foto e descomente
    color: "ink",
  },
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
  href: string;
  external: boolean;
  // `photo`: foto grande de um produto; `cards`: cartas do catálogo em leque.
  display: "photo" | "cards" | "empty";
  images: { src: string; alt: string; direct: boolean }[];
};

function cardImages(banner: Banner) {
  return PRODUCTS.filter((p) => p.image && (!banner.game || p.game === banner.game))
    .slice(0, 2)
    .map((p) => ({ src: p.image!, alt: p.name, direct: loadImageDirectly(p.image!) }));
}

export function getFanBanners(): FanBanner[] {
  return BANNERS.map((banner) => {
    const product = banner.productSlug ? getProductBySlug(banner.productSlug) : undefined;
    const photo = banner.image ?? product?.image;
    const href =
      banner.href ??
      (product ? `/produto/${product.slug}` : whatsappLink(banner.whatsappMessage ?? `Olá! Vi o banner ${banner.title}.`));

    if (photo) {
      return {
        ...banner,
        href,
        external: href.startsWith("http"),
        display: "photo",
        images: [{ src: photo, alt: product?.name ?? banner.title, direct: loadImageDirectly(photo) }],
      };
    }

    // Banner de pré-venda sem foto ainda: mostra o espaço reservado para a foto.
    const images = banner.badge ? [] : cardImages(banner);
    return {
      ...banner,
      href,
      external: href.startsWith("http"),
      display: images.length > 0 ? "cards" : "empty",
      images,
    };
  });
}
