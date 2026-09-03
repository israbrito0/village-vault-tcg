import Link from "next/link";

export default function Hero() {
  return (
    <section
      className="relative mx-5 my-5 overflow-hidden rounded-lg border border-card-border bg-ink"
      style={{ aspectRatio: "1600 / 620" }}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/hero-poster.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/25 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-center px-6 sm:max-w-sm sm:px-8">
        <div className="motion-safe:animate-fade-in-up">
          <h1 className="font-display text-xl leading-snug text-cream sm:text-2xl">
            Toda coleção começa
            <br />
            com uma boa carta
          </h1>
          <p className="mt-3 text-sm text-muted">
            Pokémon, Magic e outros TCGs, com condição e estoque verificados.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
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
            className="relative mt-6 inline-flex overflow-hidden rounded bg-gold px-6 py-2.5 text-sm font-medium text-ink"
          >
            <span className="relative z-10">Explorar catálogo</span>
            <span className="pointer-events-none absolute inset-0 motion-safe:animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </Link>
        </div>
      </div>
    </section>
  );
}
