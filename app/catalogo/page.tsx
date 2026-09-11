import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { PRODUCTS } from "@/lib/products";
import { GAMES, SUBCATEGORIES } from "@/lib/types";

export const metadata: Metadata = { title: "Catálogo" };

// "Pokémon" e "pokemon" precisam dar o mesmo resultado.
function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

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

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 sm:flex-row">
      <aside className="w-full shrink-0 sm:w-52">
        <p className="mb-2 font-display text-xs tracking-wide text-gold">Jogo</p>
        <ul className="mb-5 space-y-1 text-xs text-cream/80">
          <li>
            <Link href="/catalogo" className={!jogo ? "text-gold" : "hover:text-gold"}>
              Todos
            </Link>
          </li>
          {GAMES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/catalogo?jogo=${g.slug}`}
                className={jogo === g.slug ? "text-gold" : "hover:text-gold"}
              >
                {g.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mb-2 font-display text-xs tracking-wide text-gold">Categoria</p>
        <ul className="space-y-1 text-xs text-cream/80">
          {SUBCATEGORIES.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/catalogo?${jogo ? `jogo=${jogo}&` : ""}subcategoria=${s.slug}`}
                className={subcategoria === s.slug ? "text-gold" : "hover:text-gold"}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1">
        <p className="mb-4 text-xs text-muted">
          {produtos.length} produtos encontrados
          {busca && (
            <>
              {" "}para <span className="text-cream">“{busca}”</span>
            </>
          )}
        </p>
        {produtos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum produto encontrado com esse filtro.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {produtos.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
