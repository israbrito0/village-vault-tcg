import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="flex flex-wrap items-center gap-4 px-5 py-4">
      <Link href="/" className="flex items-center gap-2 whitespace-nowrap">
        <Image src="/logo.jpg" alt="Village & Vault TCG" width={36} height={36} className="rounded-full" />
        <span className="font-display text-sm font-semibold tracking-wider text-gold">
          VILLAGE &amp; VAULT
        </span>
      </Link>

      <form action="/catalogo" className="flex min-w-[180px] flex-1 flex-col gap-0.5">
        <div className="flex">
          <input
            name="busca"
            placeholder="Faça sua busca"
            className="w-full rounded-l border border-card-border bg-card px-3 py-2 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="rounded-r bg-gold px-3 text-ink"
            aria-label="Buscar"
          >
            ⌕
          </button>
        </div>
        <Link href="/catalogo" className="text-[10px] text-muted hover:text-gold">
          busca avançada
        </Link>
      </form>

      <div className="flex items-center gap-4 whitespace-nowrap text-[11px] text-cream/80">
        <Link href="/conta" className="flex items-center gap-2 hover:text-gold">
          <span className="text-lg">◈</span>
          <span className="leading-tight">
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
    </header>
  );
}
