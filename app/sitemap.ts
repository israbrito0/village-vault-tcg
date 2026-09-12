import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/lib/products";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // "/leiloes" entra aqui quando o banco do leilão estiver ligado.
  const pages = ["", "/catalogo", "/ranking", "/faq", "/trocas", "/torneios"].map((path) => ({
    url: `${SITE_URL}${path}`,
  }));
  const produtos = PRODUCTS.map((p) => ({ url: `${SITE_URL}/produto/${p.slug}` }));
  return [...pages, ...produtos];
}
