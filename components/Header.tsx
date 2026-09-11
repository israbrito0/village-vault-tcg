import Image from "next/image";
import Link from "next/link";
import { Heart, Search, ShoppingCart, User } from "lucide-react";

export default function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
      <Link href="/" className="flex items-center gap-2 whitespace-nowrap sm:gap-3">
        <Image
          src="/logo.jpg"
          alt="Village & Vault TCG"
          width={92}
          height={92}
          priority
          className="h-11 w-11 rounded-full object-cover sm:h-[92px] sm:w-[92px]"
        />
        <span className="font-display text-sm font-semibold tracking-wider text-gold-deep sm:text-lg">
          VILLAGE &amp; VAULT
        </span>
      </Link>

      <div className="flex items-center gap-4 whitespace-nowrap text-[11px] text-cream/80 sm:order-3">
        <Link href="/conta" className="flex items-center gap-2 hover:text-gold-deep" aria-label="Entrar ou cadastrar">
          <User size={20} strokeWidth={1.5} />
          <span className="hidden leading-tight sm:inline">
            Faça login
            <br />
            ou cadastre-se
          </span>
        </Link>
        <Link href="/favoritos" className="hover:text-gold-deep" aria-label="Favoritos">
          <Heart size={20} strokeWidth={1.5} />
        </Link>
        <Link href="/carrinho" className="hover:text-gold-deep" aria-label="Carrinho">
          <ShoppingCart size={20} strokeWidth={1.5} />
        </Link>
      </div>

      <form
        action="/catalogo"
        className="order-4 flex w-full flex-col gap-0.5 sm:order-2 sm:w-auto sm:max-w-sm sm:flex-1"
      >
        <div className="flex">
          <input
            name="busca"
            type="search"
            placeholder="Faça sua busca"
            aria-label="Buscar produtos"
            className="w-full rounded-l border border-card-border bg-card px-3 py-1.5 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-gold"
          />
          <button type="submit" className="rounded-r bg-gold px-3 text-ink" aria-label="Buscar">
            <Search size={16} strokeWidth={2} />
          </button>
        </div>
        <Link href="/catalogo" className="hidden text-[10px] text-muted hover:text-gold-deep sm:inline">
          busca avançada
        </Link>
      </form>
    </header>
  );
}
