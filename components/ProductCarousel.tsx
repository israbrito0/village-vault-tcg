"use client";

import { useRef } from "react";
import { Product } from "@/lib/mock-data";
import ProductCard from "./ProductCard";

export default function ProductCarousel({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  return (
    <section className="px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xs tracking-wide text-gold">{title}</h2>
        <div className="flex gap-3 text-muted">
          <button onClick={() => scroll(-1)} aria-label="Anterior" className="hover:text-gold">
            ‹
          </button>
          <button onClick={() => scroll(1)} aria-label="Próximo" className="hover:text-gold">
            ›
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-3 overflow-x-auto sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-6"
      >
        {products.map((product) => (
          <div key={product.id} className="w-[150px] shrink-0 sm:w-auto">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
