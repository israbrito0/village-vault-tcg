export type GameSlug =
  | "pokemon"
  | "magic"
  | "yugioh"
  | "one-piece"
  | "lorcana"
  | "outros";

export type SubcategorySlug =
  | "cartas-avulsas"
  | "cartas-graduadas"
  | "produtos-selados"
  | "colecionaveis"
  | "produtos-antigos-raros"
  | "codigos-digitais";

export interface Game {
  slug: GameSlug;
  label: string;
}

export interface Subcategory {
  slug: SubcategorySlug;
  label: string;
}

export const GAMES: Game[] = [
  { slug: "pokemon", label: "Pokémon TCG" },
  { slug: "magic", label: "Magic: The Gathering" },
  { slug: "yugioh", label: "Yu-Gi-Oh!" },
  { slug: "one-piece", label: "One Piece" },
  { slug: "lorcana", label: "Lorcana" },
  { slug: "outros", label: "Outros TCGs" },
];

export const SUBCATEGORIES: Subcategory[] = [
  { slug: "cartas-avulsas", label: "Cartas avulsas" },
  { slug: "cartas-graduadas", label: "Cartas graduadas" },
  { slug: "produtos-selados", label: "Produtos selados" },
  { slug: "colecionaveis", label: "Colecionáveis" },
  { slug: "produtos-antigos-raros", label: "Produtos antigos e raros" },
  { slug: "codigos-digitais", label: "Códigos digitais" },
];

export type Condition = "Novo" | "NM" | "SP" | "MP" | "HP" | "Graduada";
export type Origin = "BR" | "US" | "JP";

export interface Product {
  id: string;
  slug: string;
  name: string;
  game: GameSlug;
  subcategory: SubcategorySlug;
  setName: string;
  priceCents: number;
  compareAtPriceCents?: number;
  condition: Condition;
  origin: Origin;
  stock: number;
  featured?: boolean;
  description: string;
}
