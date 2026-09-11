import { PRODUCTS, getProductBySlug, loadImageDirectly } from "./products";
import { whatsappLink } from "./site";
import type { GameSlug, Origin } from "./types";

// Banners largos do topo do catálogo e das páginas do menu.
//
// Imagens de cada slide, na ordem de preferência:
// 1. `images`: fotos próprias em public/banners/ (ex.: "/banners/30-anos-box.png");
// 2. `productSlugs`: fotos de produtos da planilha;
// 3. com `game`, as cartas de maior valor desse jogo que estão no catálogo.
// `imageStyle: "scene"`: foto oficial com fundo (ex.: vitrine da Pokémon), mostrada
// inteira numa moldura. Sem isso, a foto é tratada como recorte com fundo transparente.
// `background` é uma imagem de fundo opcional; sem ela, vale o degradê do `theme`.

export type SealedTheme = "gold" | "fire" | "night" | "ocean" | "forest" | "crimson";

export interface SealedSlide {
  id: string;
  game?: GameSlug;
  // Chamada no topo: "Pré-venda", "Produtos disponíveis", "Lançamento"...
  eyebrow: string;
  title: string;
  subtitle?: string;
  // Idioma do produto, vira a etiqueta "Produto em inglês" etc.
  origin?: Origin;
  images?: string[];
  productSlugs?: string[];
  imageStyle?: "cutout" | "scene";
  background?: string;
  theme: SealedTheme;
  cta: string;
  href?: string;
  whatsappMessage?: string;
}

// Fotos oficiais das fabricantes, usadas como material de divulgação de revendedor:
// 30 anos (pokemon.com/br), Lorcana (disneylorcana.com) e One Piece (onepiece-cardgame.com).
export const SEALED_SLIDES: SealedSlide[] = [
  {
    id: "30-anos",
    game: "pokemon",
    eyebrow: "Pré-venda · 16/09",
    title: "Celebração de 30 Anos",
    subtitle: "Pokémon TCG · Coleção Treinador Avançado, Ultra Premium, Mini Latas e muito mais.",
    origin: "BR",
    images: ["/banners/30-anos-linha-completa.png"],
    imageStyle: "scene",
    theme: "gold",
    cta: "Quero reservar",
    whatsappMessage: "Olá! Quero reservar produtos da pré-venda Celebração de 30 Anos.",
  },
  {
    id: "lorcana",
    game: "lorcana",
    eyebrow: "Lançamento",
    title: "Disney Lorcana",
    subtitle: "Attack of the Vine · Booster Display, Illumineer's Trove, Starter Set e Prerelease Box.",
    images: [
      "/banners/lorcana-booster-display.png",
      "/banners/lorcana-trove.png",
      "/banners/lorcana-starter-set.png",
      "/banners/lorcana-prerelease.png",
    ],
    theme: "forest",
    cta: "Consultar pelo WhatsApp",
    whatsappMessage: "Olá! Quero saber sobre os produtos de Lorcana Attack of the Vine.",
  },
  {
    id: "one-piece",
    game: "one-piece",
    eyebrow: "Lançamento",
    title: "One Piece Card Game",
    subtitle: "Booster OP-17 e Starter Decks ST-31 a ST-36.",
    // As fotos oficiais dos starter decks mostram a embalagem japonesa.
    images: [
      "/banners/onepiece-op17.webp",
      "/banners/onepiece-st31.webp",
      "/banners/onepiece-st32.webp",
      "/banners/onepiece-st33.webp",
      "/banners/onepiece-st34.webp",
      "/banners/onepiece-st35.webp",
      "/banners/onepiece-st36.webp",
    ],
    theme: "crimson",
    cta: "Consultar pelo WhatsApp",
    whatsappMessage: "Olá! Quero saber sobre os produtos de One Piece (OP-17 e Starter Decks).",
  },
  {
    id: "pokemon",
    game: "pokemon",
    eyebrow: "Produtos disponíveis",
    title: "Pokémon TCG",
    subtitle: "Cartas avulsas, boosters e selados.",
    theme: "ocean",
    cta: "Ver Pokémon",
    href: "/catalogo?jogo=pokemon",
  },
  {
    id: "magic",
    game: "magic",
    eyebrow: "Produtos disponíveis",
    title: "Magic: The Gathering",
    subtitle: "Clássicos, raridades e lançamentos.",
    theme: "fire",
    cta: "Ver Magic",
    href: "/catalogo?jogo=magic",
  },
];

const ORIGIN_LABELS: Record<Origin, string> = {
  BR: "Produto nacional",
  US: "Produto em inglês",
  JP: "Produto japonês",
};

export type SealedSlideView = SealedSlide & {
  href: string;
  external: boolean;
  language?: string;
  // "product": recorte de caixa/lata; "scene": foto oficial com fundo, numa moldura;
  // "card": carta do catálogo.
  photoKind: "product" | "scene" | "card";
  photos: { src: string; direct: boolean }[];
};

// Até 7 produtos num slide (ex.: booster + 6 starter decks); cartas usam as 3 primeiras.
const MAX_PHOTOS = 7;

// Cartas mais valiosas do jogo que têm imagem no catálogo.
function topCardImages(game: GameSlug) {
  return PRODUCTS.filter((p) => p.game === game && p.image)
    .sort((a, b) => b.priceCents - a.priceCents)
    .map((p) => p.image!);
}

export function getSealedSlides(): SealedSlideView[] {
  return SEALED_SLIDES.map((slide) => {
    const productPhotos = [
      ...(slide.images ?? []),
      ...(slide.productSlugs ?? [])
        .map((slug) => getProductBySlug(slug)?.image)
        .filter((src): src is string => Boolean(src)),
    ];
    const usesCards = productPhotos.length === 0 && Boolean(slide.game);
    const photos = usesCards ? topCardImages(slide.game!).slice(0, 3) : productPhotos;
    const href = slide.href ?? whatsappLink(slide.whatsappMessage ?? `Olá! Vi o banner ${slide.title}.`);

    return {
      ...slide,
      href,
      external: href.startsWith("http"),
      language: slide.origin ? ORIGIN_LABELS[slide.origin] : undefined,
      photoKind: usesCards ? "card" : slide.imageStyle === "scene" ? "scene" : "product",
      photos: photos.slice(0, MAX_PHOTOS).map((src) => ({ src, direct: loadImageDirectly(src) })),
    };
  });
}
