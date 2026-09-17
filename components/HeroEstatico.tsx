import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import { LIVE_URL } from "@/lib/site";
import LiveLink from "./LiveLink";
import Wordmark from "./Wordmark";

// Versão parada da entrada: aparece enquanto o 3D carrega, para quem pediu
// menos movimento no sistema e para navegadores sem WebGL.

export const MENU_INICIAL = [
  { label: "Catálogo", href: "/catalogo" },
  { label: "Cartas avulsas", href: "/catalogo?subcategoria=cartas-avulsas" },
  { label: "Selados", href: "/catalogo?subcategoria=produtos-selados" },
  { label: "Dúvidas?", href: "/faq" },
];

export default function HeroEstatico() {
  return (
    <section className="relative flex min-h-[92vh] flex-col items-center justify-center bg-[#07060a] px-5 py-16 text-center text-white">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 65%, rgba(255,122,26,0.16), transparent 70%), radial-gradient(40% 30% at 50% 20%, rgba(244,175,20,0.08), transparent 70%)",
        }}
      />
      <div className="absolute right-4 top-4 flex gap-4 text-white/70">
        <Link href="/catalogo" aria-label="Buscar produtos" className="hover:text-white">
          <Search size={20} strokeWidth={1.75} />
        </Link>
        <Link href="/carrinho" aria-label="Carrinho" className="hover:text-white">
          <ShoppingCart size={20} strokeWidth={1.75} />
        </Link>
      </div>
      <div className="relative">
        <Wordmark large tone="dark" />
        <nav aria-label="Menu inicial" className="mt-12 grid grid-cols-2 gap-3 sm:gap-4">
          {MENU_INICIAL.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="w-[150px] rounded border-2 border-gold/60 bg-white/5 px-3 py-3 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:border-gold hover:bg-gold hover:text-ink sm:w-[180px]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-8 text-xs text-white/60">Frete calculado na hora · 12x sem juros · 5% off no Pix</p>
        <LiveLink href={LIVE_URL} className="mt-4 text-xs" />
      </div>
    </section>
  );
}
