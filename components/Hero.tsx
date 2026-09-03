import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative mx-5 my-5 overflow-hidden rounded-lg border border-card-border bg-card">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 78% 45%, rgba(201,162,39,0.16), transparent 65%)",
        }}
      />

      <div className="relative flex flex-col items-center justify-between gap-8 px-6 py-10 sm:flex-row sm:py-12">
        <div className="motion-safe:animate-fade-in-up">
          <h1 className="font-display text-2xl leading-snug text-cream sm:text-3xl">
            Toda coleção começa
            <br />
            com uma boa carta
          </h1>
          <p className="mt-3 max-w-xs text-sm text-muted">
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

        {/* Capa ilustrada: cofre/dragão animado */}
        <svg
          width="220"
          height="220"
          viewBox="0 0 400 400"
          className="shrink-0 motion-safe:animate-fade-in-up"
          role="img"
          aria-label="Emblema Village & Vault: dragão e cofre dourado"
        >
          <defs>
            <radialGradient id="vv-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C9A227" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#C9A227" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Asas estilizadas */}
          <g fill="#5C4E1E" opacity="0.55">
            <path d="M200 130 C235 100 270 85 320 78 C305 108 320 122 350 118 C330 142 338 160 362 172 C332 176 322 196 340 214 C308 202 292 214 274 200 C262 218 234 214 214 190 Z" />
            <g transform="translate(400,0) scale(-1,1)">
              <path d="M200 130 C235 100 270 85 320 78 C305 108 320 122 350 118 C330 142 338 160 362 172 C332 176 322 196 340 214 C308 202 292 214 274 200 C262 218 234 214 214 190 Z" />
            </g>
          </g>

          {/* Brilho central pulsante */}
          <circle cx="200" cy="210" r="55" fill="url(#vv-glow)" className="motion-safe:animate-pulse-gold" />

          {/* Anel externo do cofre, girando devagar */}
          <g style={{ transformOrigin: "200px 210px" }} className="motion-safe:animate-spin-slow">
            <circle cx="200" cy="210" r="120" fill="none" stroke="#5C4E1E" strokeWidth="1.5" strokeDasharray="2 6" />
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x1 = 200 + Math.cos(angle) * 112;
              const y1 = 210 + Math.sin(angle) * 112;
              const x2 = 200 + Math.cos(angle) * 128;
              const y2 = 210 + Math.sin(angle) * 128;
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C9A227" strokeWidth="2" />
              );
            })}
          </g>

          {/* Anel interno + ponteiro, girando em sentido contrário */}
          <g style={{ transformOrigin: "200px 210px" }} className="motion-safe:animate-spin-slow-reverse">
            <circle cx="200" cy="210" r="80" fill="none" stroke="#C9A227" strokeWidth="1.5" />
            <line x1="200" y1="210" x2="200" y2="140" stroke="#C9A227" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          <circle cx="200" cy="210" r="7" fill="#C9A227" />
        </svg>
      </div>
    </section>
  );
}
