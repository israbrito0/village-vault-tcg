import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
      <Link href="/" className="flex items-center gap-2 whitespace-nowrap sm:gap-3">
        <Image
          src="/logo.jpg"
          alt="Village & Vault TCG"
          width={92}
          height={92}
          className="h-11 w-11 rounded-full object-cover sm:h-[92px] sm:w-[92px]"
        />
        <span className="font-display text-sm font-semibold tracking-wider text-gold sm:text-lg">
          VILLAGE &amp; VAULT
        </span>
      </Link>

      <div className="flex items-center gap-3.5 whitespace-nowrap text-[11px] text-cream/80 sm:gap-4 sm:order-3">
        <Link href="/conta" className="flex items-center gap-2 hover:text-gold" aria-label="Entrar ou cadastrar">
          <span className="text-lg">◈</span>
          <span className="hidden leading-tight sm:inline">
            Faça login
            <br />
            ou cadastre-se
          </span>
        </Link>
        <Link href="/favoritos" className="relative hover:text-gold" aria-label="Favoritos">
          <span className="text-lg">♡</span>
          <span className="absolute -right-2 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-[8px] text-ink">
            0
          </span>
        </Link>
        <Link href="/carrinho" className="relative hover:text-gold" aria-label="Carrinho">
          <span className="text-lg">⛁</span>
          <span className="absolute -right-2 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-[8px] text-ink">
            0
          </span>
        </Link>
      </div>

      <form
        action="/catalogo"
        className="order-4 flex w-full flex-col gap-0.5 sm:order-2 sm:w-auto sm:max-w-sm sm:flex-1"
      >
        <div className="flex">
          <input
            name="busca"
            placeholder="Faça sua busca"
            className="w-full rounded-l border border-card-border bg-card px-3 py-1.5 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-gold"
          />
          <button type="submit" className="rounded-r bg-gold px-3 text-ink" aria-label="Buscar">
            ⌕
          </button>
        </div>
        <Link href="/catalogo" className="hidden text-[10px] text-muted hover:text-gold sm:inline">
          busca avançada
        </Link>
      </form>
    </header>
  );
}
