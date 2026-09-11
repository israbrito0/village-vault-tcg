import BannerFan, { type FanBanner } from "@/components/BannerFan";
import Hero from "@/components/Hero";
import ProductCarousel from "@/components/ProductCarousel";
import { BANNERS } from "@/lib/banners";
import { PRODUCTS, getFeaturedProducts, loadImageDirectly } from "@/lib/products";

// Cada banner mostra até duas cartas com foto do jogo dele (ou de qualquer jogo).
function bannersWithImages(): FanBanner[] {
  return BANNERS.map((banner) => ({
    ...banner,
    images: PRODUCTS.filter((p) => p.image && (!banner.game || p.game === banner.game))
      .slice(0, 2)
      .map((p) => ({ src: p.image!, alt: p.name, direct: loadImageDirectly(p.image!) })),
  }));
}

export default function HomePage() {
  const featured = getFeaturedProducts();
  const avulsas = PRODUCTS.filter((p) => p.subcategory === "cartas-avulsas");
  const selados = PRODUCTS.filter((p) => p.subcategory === "produtos-selados");
  const colecionaveis = PRODUCTS.filter((p) => p.subcategory === "colecionaveis");

  return (
    <main>
      <Hero />
      <BannerFan banners={bannersWithImages()} />
      <ProductCarousel title="Mais vendidos" products={featured} />
      <ProductCarousel title="Cartas avulsas" products={avulsas} />
      <ProductCarousel title="Produtos selados" products={selados} />
      <ProductCarousel title="Colecionáveis" products={colecionaveis} />
    </main>
  );
}
