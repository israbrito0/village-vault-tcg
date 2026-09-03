import Link from "next/link";

export default function Hero() {
  return (
    <section className="mx-5 my-5 flex flex-col items-center justify-between gap-6 rounded-lg border border-card-border bg-card px-6 py-8 sm:flex-row">
      <div>
        <h1 className="font-display text-xl leading-snug text-cream sm:text-2xl">
          Toda coleção começa
          <br />
          com uma boa carta
        </h1>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Pokémon, Magic e outros TCGs, com condição e estoque verificados.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded border border-gold-dim px-2 py-1 text-[10px] text-gold">
            Frete grátis
          </span>
          <span className="rounded border border-gold-dim px-2 py-1 text-[10px] text-gold">
            12x sem juros
          </span>
          <span className="rounded border border-gold-dim px-2 py-1 text-[10px] text-gold">
            5% off no Pix
          </span>
        </div>
        <Link
          href="/catalogo"
          className="mt-5 inline-block rounded bg-gold px-5 py-2 text-sm font-medium text-ink"
        >
          Explorar catálogo
        </Link>
      </div>
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true" className="shrink-0">
        <circle cx="70" cy="70" r="60" fill="none" stroke="#5C4E1E" strokeWidth={1} />
        <circle cx="70" cy="70" r="44" fill="none" stroke="#C9A227" strokeWidth={1} />
        <circle cx="70" cy="70" r="6" fill="#C9A227" />
        <line x1="70" y1="70" x2="70" y2="26" stroke="#C9A227" strokeWidth={2} />
        <line x1="70" y1="70" x2="104" y2="88" stroke="#5C4E1E" strokeWidth={2} />
      </svg>
    </section>
  );
}
