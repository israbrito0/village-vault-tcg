import Image from "next/image";
import Link from "next/link";
import { Product, formatPriceBRL } from "@/lib/mock-data";

export default function ProductCard({ product }: { product: Product }) {
  const discount =
    product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents
      ? Math.round(
          ((product.compareAtPriceCents - product.priceCents) /
            product.compareAtPriceCents) *
            100
        )
      : null;

  return (
    <Link
      href={`/produto/${product.slug}`}
      className="group block w-[150px] shrink-0 rounded-md border border-card-border bg-card p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-dim hover:shadow-[0_0_24px_-6px_rgba(201,162,39,0.35)] sm:w-auto"
    >
      <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded border border-card-border bg-ink">
        {discount && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-danger px-1.5 py-0.5 text-[9px] text-cream">
            -{discount}%
          </span>
        )}
        <Image
          src="/placeholder-card.svg"
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="150px"
        />
      </div>
      <p className="truncate text-[11px] text-cream">{product.name}</p>
      <p className="truncate text-[10px] text-muted">{product.setName}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gold">
          {formatPriceBRL(product.priceCents)}
        </span>
        <span className="rounded border border-card-border px-1 text-[8px] text-muted">
          {product.origin}
        </span>
      </div>
    </Link>
  );
}
