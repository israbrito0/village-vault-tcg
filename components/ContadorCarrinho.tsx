"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { lerCarrinho, ouvirCarrinho } from "@/lib/carrinho";

// Ícone do carrinho no topo do site, com a quantidade de itens.
export default function ContadorCarrinho() {
  const [itens, setItens] = useState(0);

  useEffect(() => {
    const contar = () => setItens(lerCarrinho().reduce((t, l) => t + l.quantidade, 0));
    contar();
    return ouvirCarrinho(contar);
  }, []);

  return (
    <Link href="/carrinho" className="relative hover:text-ink" aria-label={`Carrinho${itens ? ` com ${itens} itens` : ""}`}>
      <ShoppingCart size={20} strokeWidth={1.75} />
      {itens > 0 && (
        <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[9px] font-bold text-white">
          {itens}
        </span>
      )}
    </Link>
  );
}
