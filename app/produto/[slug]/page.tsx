import Image from "next/image";
import { notFound } from "next/navigation";
import { PRODUCTS, getProductBySlug, formatPriceBRL } from "@/lib/mock-data";
import { GAMES, SUBCATEGORIES } from "@/lib/types";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export default function ProdutoPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const gameLabel = GAMES.find((g) => g.slug === product.game)?.label ?? product.game;
  const subLabel =
    SUBCATEGORIES.find((s) => s.slug === product.subcategory)?.label ?? product.subcategory;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="aspect-[3/4] overflow-hidden rounded-lg border border-card-border bg-card">
          <Image
            src="/placeholder-card.svg"
            alt={product.name}
            width={500}
            height={667}
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {gameLabel} · {subLabel}
          </p>
          <h1 className="mt-1 font-display text-xl text-cream">{product.name}</h1>
          <p className="mt-1 text-sm text-muted">{product.setName}</p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-medium text-gold">
              {formatPriceBRL(product.priceCents)}
            </span>
            {product.compareAtPriceCents && (
              <span className="text-sm text-muted line-through">
                {formatPriceBRL(product.compareAtPriceCents)}
              </span>
            )}
          </div>

          <div className="mt-3 flex gap-2 text-[11px]">
            <span className="rounded border border-card-border px-2 py-1 text-cream/80">
              Condição: {product.condition}
            </span>
            <span className="rounded border border-card-border px-2 py-1 text-cream/80">
              Origem: {product.origin}
            </span>
            <span className="rounded border border-card-border px-2 py-1 text-cream/80">
              {product.stock} em estoque
            </span>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-cream/80">{product.description}</p>

          <button className="mt-6 w-full rounded bg-gold py-3 text-sm font-medium text-ink sm:w-auto sm:px-8">
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </main>
  );
}
