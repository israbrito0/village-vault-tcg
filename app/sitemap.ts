import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/lib/mock-data";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/catalogo", "/faq", "/trocas", "/torneios"].map((path) => ({
    url: `${SITE_URL}${path}`,
  }));
  const produtos = PRODUCTS.map((p) => ({ url: `${SITE_URL}/produto/${p.slug}` }));
  return [...pages, ...produtos];
}
