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

export type SealedTheme = "gold" | "fire" | "night" | "ocean";

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

// Fotos dos 30 anos: imagens oficiais da vitrine da The Pokémon Company
// (pokemon.com/br), usadas como material de divulgação de revendedor.
export const SEALED_SLIDES: SealedSlide[] = [
  {
    id: "30-anos-etb",
    game: "pokemon",
    eyebrow: "Pré-venda · 16/09",
    title: "Coleção Treinador Avançado",
    subtitle: "Celebração de 30 Anos · 9 boosters, carta promocional e acessórios.",
    origin: "BR",
    images: ["/banners/30-anos-etb.png"],
    imageStyle: "scene",
    theme: "gold",
    cta: "Quero reservar",
    whatsappMessage: "Olá! Quero reservar na pré-venda: Coleção Treinador Avançado – Celebração de 30 Anos.",
  },
  {
    id: "30-anos-upc",
    game: "pokemon",
    eyebrow: "Pré-venda",
    title: "Coleção Ultra Premium",
    subtitle: "Celebração de 30 Anos · Dia e Noite · previsão: 4º trimestre de 2026.",
    origin: "BR",
    images: ["/banners/30-anos-upc-dia-noite.png"],
    imageStyle: "scene",
    theme: "night",
    cta: "Quero reservar",
    whatsappMessage: "Olá! Quero reservar na pré-venda: Coleção Ultra Premium Dia e Noite – Celebração de 30 Anos.",
  },
  {
    id: "30-anos-mini-latas",
    game: "pokemon",
    eyebrow: "Pré-venda",
    title: "Mini Latas",
    subtitle: "Celebração de 30 Anos · previsão: 4º trimestre de 2026.",
    // A imagem oficial disponível é a da versão americana da lata.
    images: ["/banners/30-anos-mini-lata.png"],
    imageStyle: "scene",
    theme: "ocean",
    cta: "Quero reservar",
    whatsappMessage: "Olá! Quero reservar na pré-venda: Mini Latas – Celebração de 30 Anos.",
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
    const photos = usesCards ? topCardImages(slide.game!) : productPhotos;
    const href = slide.href ?? whatsappLink(slide.whatsappMessage ?? `Olá! Vi o banner ${slide.title}.`);

    return {
      ...slide,
      href,
      external: href.startsWith("http"),
      language: slide.origin ? ORIGIN_LABELS[slide.origin] : undefined,
      photoKind: usesCards ? "card" : slide.imageStyle === "scene" ? "scene" : "product",
      photos: photos.slice(0, 3).map((src) => ({ src, direct: loadImageDirectly(src) })),
    };
  });
}
