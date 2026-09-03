import Hero from "@/components/Hero";
import ProductCarousel from "@/components/ProductCarousel";
import { PRODUCTS, getFeaturedProducts } from "@/lib/mock-data";

export default function HomePage() {
  const featured = getFeaturedProducts();
  const selados = PRODUCTS.filter((p) => p.subcategory === "produtos-selados");
  const colecionaveis = PRODUCTS.filter((p) => p.subcategory === "colecionaveis");

  return (
    <main>
      <Hero />
      <ProductCarousel title="Mais vendidos" products={featured} />
      <ProductCarousel title="Produtos selados" products={selados} />
      <ProductCarousel title="Colecionáveis" products={colecionaveis} />
    </main>
  );
}
