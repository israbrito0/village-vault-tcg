"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";
import { adicionarAoCarrinho } from "@/lib/carrinho";

export default function BotaoCarrinho({ slug, estoque }: { slug: string; estoque: number }) {
  const [adicionado, setAdicionado] = useState(false);

  if (estoque <= 0) {
    return (
      <p className="mt-7 rounded border border-card-border px-4 py-3 text-center text-[13px] font-bold uppercase text-muted">
        Esgotado
      </p>
    );
  }

  return (
    <div className="mt-7 flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={() => {
          adicionarAoCarrinho(slug, 1, estoque);
          setAdicionado(true);
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded border-2 border-brand-yellow bg-brand-yellow py-3 text-[13px] font-bold uppercase tracking-wide text-ink shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-colors hover:bg-white sm:w-auto sm:px-10"
      >
        {adicionado ? <Check size={18} /> : <ShoppingCart size={18} />}
        {adicionado ? "No carrinho" : "Adicionar ao carrinho"}
      </button>
      {adicionado && (
        <Link
          href="/carrinho"
          className="inline-flex w-full items-center justify-center rounded border-2 border-ink py-3 text-[13px] font-bold uppercase tracking-wide text-ink sm:w-auto sm:px-8"
        >
          Ver carrinho
        </Link>
      )}
    </div>
  );
}
