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
      className="group block w-full rounded-lg border border-card-border bg-white p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-[0_14px_28px_-14px_rgba(51,56,68,0.45)]"
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
      <p className="truncate text-[12px] font-medium text-ink">{product.name}</p>
      <p className="truncate text-[10px] text-muted">{product.setName}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink">
          {formatPriceBRL(product.priceCents)}
        </span>
        <span className="rounded-full bg-surface px-1.5 text-[9px] font-bold text-muted">
          {product.origin}
        </span>
      </div>
    </Link>
  );
}
