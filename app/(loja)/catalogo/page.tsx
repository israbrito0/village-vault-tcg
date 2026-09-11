import type { Metadata } from "next";
import Link from "next/link";
import PageTitle from "@/components/PageTitle";
import ProductCard from "@/components/ProductCard";
import Promocoes from "@/components/Promocoes";
import { ACCENT_ACTIVE, ACCENT_BUTTON, BUTTON_BASE, accentAt } from "@/components/ui";
import { PRODUCTS, type Product } from "@/lib/products";
import { GAMES, SUBCATEGORIES } from "@/lib/types";

export const metadata: Metadata = { title: "Catálogo" };

// "Pokémon" e "pokemon" precisam dar o mesmo resultado.
function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

type Filters = { jogo?: string; subcategoria?: string; colecao?: string };

// Monta o link de um filtro mantendo os outros que já estavam escolhidos.
function filterHref(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.jogo) params.set("jogo", filters.jogo);
  if (filters.subcategoria) params.set("subcategoria", filters.subcategoria);
  if (filters.colecao) params.set("colecao", filters.colecao);
  const query = params.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}

const CHIP = "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors";

// Cartas avulsas e graduadas são agrupadas pela categoria (cada carta é de uma
// coleção diferente); selados, colecionáveis etc. são agrupados pela coleção.
const CARD_CATEGORIES = new Set(["cartas-avulsas", "cartas-graduadas"]);

type Group = { key: string; title: string; filter: Filters; items: Product[] };

function groupProducts(items: Product[]): Group[] {
  const groups = new Map<string, Group>();
  for (const p of items) {
    const byCategory = CARD_CATEGORIES.has(p.subcategory) || !p.setName;
    const key = byCategory ? `categoria:${p.subcategory}` : `colecao:${p.setName}`;
    if (!groups.has(key)) {
      groups.set(
        key,
        byCategory
          ? {
              key,
              title: SUBCATEGORIES.find((s) => s.slug === p.subcategory)?.label ?? p.subcategory,
              filter: { subcategoria: p.subcategory },
              items: [],
            }
          : { key, title: p.setName, filter: { colecao: p.setName }, items: [] },
      );
    }
    groups.get(key)!.items.push(p);
  }
  // Coleções primeiro, na ordem da planilha; depois os grupos de cartas.
  const all = [...groups.values()];
  return [...all.filter((g) => g.key.startsWith("colecao:")), ...all.filter((g) => g.key.startsWith("categoria:"))];
}

export default function CatalogoPage({
  searchParams,
}: {
  searchParams: { jogo?: string; subcategoria?: string; colecao?: string; busca?: string };
}) {
  const { jogo, subcategoria, colecao, busca } = searchParams;
  const termo = busca ? normalize(busca.trim()) : "";

  const produtos = PRODUCTS.filter((p) => {
    if (jogo && p.game !== jogo) return false;
    if (subcategoria && p.subcategory !== subcategoria) return false;
    if (colecao && p.setName !== colecao) return false;
    if (termo) {
      const gameLabel = GAMES.find((g) => g.slug === p.game)?.label ?? "";
      if (!normalize(`${p.name} ${p.setName} ${gameLabel}`).includes(termo)) return false;
    }
    return true;
  });

  const title = colecao ?? GAMES.find((g) => g.slug === jogo)?.label ?? "Catálogo";
  const subLabel = SUBCATEGORIES.find((s) => s.slug === subcategoria)?.label;
  const groups = groupProducts(produtos);
  // Com um filtro que já define o grupo (uma coleção, ou uma categoria com um grupo só),
  // os títulos dos grupos seriam repetitivos.
  const showGroupTitles = groups.length > 1 || (!subcategoria && !colecao);

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
          groups.map((group) => (
            <section key={group.key} className="mt-10">
              {showGroupTitles && (
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-card-border pb-2">
                  <h2 className="font-display text-lg font-bold text-ink sm:text-xl">{group.title}</h2>
                  <Link
                    href={filterHref({ jogo, ...group.filter })}
                    className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted hover:text-ink"
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
