import Image from "next/image";
import Link from "next/link";
import { Product, formatPriceBRL, loadImageDirectly } from "@/lib/products";

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
      className="group block w-full rounded-md border border-card-border bg-card p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-dim hover:shadow-[0_0_24px_-6px_rgba(244,175,20,0.45)]"
    >
      <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded border border-card-border bg-surface">
        {discount && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-danger px-1.5 py-0.5 text-[9px] font-medium text-white">
            -{discount}%
          </span>
        )}
        <Image
          src={product.image ?? "/placeholder-card.svg"}
          alt={product.name}
          fill
          unoptimized={!!product.image && loadImageDirectly(product.image)}
          className={`${product.image ? "object-contain p-1.5" : "object-cover"} transition-transform duration-500 group-hover:scale-105`}
          sizes="(min-width: 640px) 220px, 150px"
        />
      </div>
      <p className="truncate text-[11px] text-cream">{product.name}</p>
      <p className="truncate text-[10px] text-muted">{product.setName}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gold-deep">
          {formatPriceBRL(product.priceCents)}
        </span>
        <span className="rounded border border-card-border px-1 text-[8px] text-muted">
          {product.origin}
        </span>
      </div>
    </Link>
  );
}
