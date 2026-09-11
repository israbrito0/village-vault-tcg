import Link from "next/link";
import { Heart, Search, ShoppingCart, User } from "lucide-react";
import Wordmark from "./Wordmark";

export default function Header() {
  return (
    <header className="relative px-4 pb-4 pt-12 sm:pt-6">
      <div className="absolute right-4 top-4 flex items-center gap-4 text-ink/70">
        <Link href="/conta" className="hover:text-ink" aria-label="Entrar ou cadastrar">
          <User size={20} strokeWidth={1.75} />
        </Link>
        <Link href="/favoritos" className="hover:text-ink" aria-label="Favoritos">
          <Heart size={20} strokeWidth={1.75} />
        </Link>
        <Link href="/carrinho" className="hover:text-ink" aria-label="Carrinho">
          <ShoppingCart size={20} strokeWidth={1.75} />
        </Link>
      </div>

      <Wordmark />

      <form action="/catalogo" className="mx-auto mt-4 flex max-w-md">
        <input
          name="busca"
          type="search"
          placeholder="Busque por carta, coleção ou jogo"
          aria-label="Buscar produtos"
          className="w-full rounded-l border-2 border-r-0 border-card-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand-blue focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-r border-2 border-brand-blue bg-brand-blue px-4 text-white transition-colors hover:bg-white hover:text-brand-blue"
          aria-label="Buscar"
        >
          <Search size={16} strokeWidth={2.25} />
        </button>
      </form>
    </header>
  );
}
