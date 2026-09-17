import HeroEntrada from "@/components/HeroEntrada";
import type { ProdutoEntrada } from "@/components/HeroCharizard";
import { SUBCATEGORIES } from "@/lib/types";
import ProductCarousel from "@/components/ProductCarousel";
import Promocoes from "@/components/Promocoes";
import { PRODUCTS, formatPriceBRL, getFeaturedProducts } from "@/lib/products";

export default function HomePage() {
  const featured = getFeaturedProducts();
  const avulsas = PRODUCTS.filter((p) => p.subcategory === "cartas-avulsas");
  const selados = PRODUCTS.filter((p) => p.subcategory === "produtos-selados");
  const colecionaveis = PRODUCTS.filter((p) => p.subcategory === "colecionaveis");

  // Os quatro que voam pela entrada: os destaques; se faltar, completa com os mais caros.
  const entrada: ProdutoEntrada[] = [...featured, ...PRODUCTS.filter((p) => !p.featured).sort((a, b) => b.priceCents - a.priceCents)]
    .filter((p) => !p.preorder && p.stock > 0)
    .slice(0, 4)
    .map((p) => ({
      slug: p.slug,
      nome: p.name,
      colecao: p.setName,
      preco: formatPriceBRL(p.priceCents),
      imagem: p.image ?? "/placeholder-card.svg",
      categoria: SUBCATEGORIES.find((s) => s.slug === p.subcategory)?.label ?? "",
    }));

  return (
    <main>
      <HeroEntrada produtos={entrada} />
      <Promocoes />
      <ProductCarousel title="Mais vendidos" products={featured} />
      <ProductCarousel title="Cartas avulsas" products={avulsas} />
      <ProductCarousel title="Produtos selados" products={selados} />
      <ProductCarousel title="Colecionáveis" products={colecionaveis} />
    </main>
  );
}
