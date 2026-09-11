import type { Metadata } from "next";
import Link from "next/link";
import PageTitle from "@/components/PageTitle";
import ProductCard from "@/components/ProductCard";
import Promocoes from "@/components/Promocoes";
import { ACCENT_ACTIVE, ACCENT_BUTTON, BUTTON_BASE, accentAt } from "@/components/ui";
import { PRODUCTS } from "@/lib/products";
import { GAMES, SUBCATEGORIES } from "@/lib/types";

export const metadata: Metadata = { title: "Catálogo" };

// "Pokémon" e "pokemon" precisam dar o mesmo resultado.
function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Monta o link de um filtro mantendo o outro filtro que já estava escolhido.
function filterHref(filters: { jogo?: string; subcategoria?: string }) {
  const params = new URLSearchParams();
  if (filters.jogo) params.set("jogo", filters.jogo);
  if (filters.subcategoria) params.set("subcategoria", filters.subcategoria);
  const query = params.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}

const CHIP = "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors";

export default function CatalogoPage({
  searchParams,
}: {
  searchParams: { jogo?: string; subcategoria?: string; busca?: string };
}) {
  const { jogo, subcategoria, busca } = searchParams;
  const termo = busca ? normalize(busca.trim()) : "";

  const produtos = PRODUCTS.filter((p) => {
    if (jogo && p.game !== jogo) return false;
    if (subcategoria && p.subcategory !== subcategoria) return false;
    if (termo) {
      const gameLabel = GAMES.find((g) => g.slug === p.game)?.label ?? "";
      if (!normalize(`${p.name} ${p.setName} ${gameLabel}`).includes(termo)) return false;
    }
    return true;
  });

  const title = GAMES.find((g) => g.slug === jogo)?.label ?? "Catálogo";
  const subLabel = SUBCATEGORIES.find((s) => s.slug === subcategoria)?.label;

  return (
    <main className="mx-auto max-w-7xl pb-8">
      <Promocoes game={jogo} />
      <div className="px-5 pt-6">
        <PageTitle
          title={title}
          subtitle={
            <>
              {subLabel ? `${subLabel} · ` : ""}
              {produtos.length} {produtos.length === 1 ? "produto" : "produtos"}
              {busca && <> para “{busca}”</>}
            </>
          }
        />

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link
            href={filterHref({ subcategoria })}
            className={`${BUTTON_BASE} px-3 py-1.5 text-[11px] ${
              jogo ? "border-card-border bg-white text-ink hover:border-ink" : "border-ink bg-ink text-white"
            }`}
          >
            Todos
          </Link>
          {GAMES.map((g, i) => (
            <Link
              key={g.slug}
              href={filterHref({ jogo: g.slug, subcategoria })}
              className={`${BUTTON_BASE} px-3 py-1.5 text-[11px] ${
                jogo === g.slug ? ACCENT_ACTIVE[accentAt(i)] : ACCENT_BUTTON[accentAt(i)]
              }`}
            >
              {g.label}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {SUBCATEGORIES.map((s) => (
            <Link
              key={s.slug}
              href={filterHref({ jogo, subcategoria: subcategoria === s.slug ? undefined : s.slug })}
              className={`${CHIP} ${
                subcategoria === s.slug
                  ? "border-ink bg-ink text-white"
                  : "border-card-border text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {produtos.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted">Nenhum produto encontrado com esse filtro.</p>
        ) : (
          // Com uma categoria escolhida, uma grade só; sem categoria, um grupo por categoria.
          SUBCATEGORIES.filter((s) => !subcategoria || s.slug === subcategoria)
            .map((s) => ({ ...s, items: produtos.filter((p) => p.subcategory === s.slug) }))
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.slug} className="mt-10">
                {!subcategoria && (
                  <div className="mb-4 flex items-baseline justify-between border-b border-card-border pb-2">
                    <h2 className="font-display text-lg font-bold text-ink sm:text-xl">{group.label}</h2>
                    <Link
                      href={filterHref({ jogo, subcategoria: group.slug })}
                      className="text-[11px] font-bold uppercase tracking-wide text-muted hover:text-ink"
                    >
                      {group.items.length} {group.items.length === 1 ? "produto" : "produtos"} →
                    </Link>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {group.items.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            ))
        )}
      </div>
    </main>
  );
}
