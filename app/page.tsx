import Hero from "@/components/Hero";
import ProductCarousel from "@/components/ProductCarousel";
import Promocoes from "@/components/Promocoes";
import { PRODUCTS, getFeaturedProducts } from "@/lib/products";

export default function HomePage() {
  const featured = getFeaturedProducts();
  const avulsas = PRODUCTS.filter((p) => p.subcategory === "cartas-avulsas");
  const selados = PRODUCTS.filter((p) => p.subcategory === "produtos-selados");
  const colecionaveis = PRODUCTS.filter((p) => p.subcategory === "colecionaveis");

  return (
    <main>
      <Hero />
      <Promocoes />
      <ProductCarousel title="Mais vendidos" products={featured} />
      <ProductCarousel title="Cartas avulsas" products={avulsas} />
      <ProductCarousel title="Produtos selados" products={selados} />
      <ProductCarousel title="Colecionáveis" products={colecionaveis} />
    </main>
  );
}
