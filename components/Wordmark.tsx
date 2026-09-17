import Link from "next/link";

// Asa de dragão desenhada para a marca (esquerda; a direita é espelhada).
// Presa pela borda direita, que é o "ombro" em volta do qual ela bate.
function Wing({ gradientId, className }: { gradientId: string; className: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      aria-hidden
      className={`origin-right motion-safe:animate-flap ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4AF14" />
          <stop offset="100%" stopColor="#9A6700" />
        </linearGradient>
      </defs>
      {/* Membrana: bordas entre as pontas curvam para dentro, como asa de dragão. */}
      <path
        d="M114 40 L74 10 Q44 0 4 18 Q30 28 18 46 Q40 44 42 64 Q58 56 76 70 Q88 58 112 50 Z"
        fill={`url(#${gradientId})`}
      />
      {/* Ossos da asa, saindo do "pulso" até cada ponta. */}
      <g stroke="#7A5200" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M114 40 L74 10" />
        <path d="M74 10 L4 18" />
        <path d="M74 10 L18 46" />
        <path d="M74 10 L42 64" />
        <path d="M74 10 L76 70" />
      </g>
    </svg>
  );
}

// Nome da loja centralizado com o subtítulo; com `wings`, ganha as asas batendo
// dos lados (hoje só na página do catálogo).
// `tone="dark"` é a versão para fundo escuro (entrada do site).
export default function Wordmark({
  large = false,
  wings = false,
  tone = "light",
}: {
  large?: boolean;
  wings?: boolean;
  tone?: "light" | "dark";
}) {
  const wingSize = large ? "w-9 sm:w-16 lg:w-24" : "w-8 sm:w-14";
  const texto = tone === "dark" ? "text-white" : "text-ink";

  return (
    <div className="text-center">
      <Link href="/" className="inline-flex items-center gap-1.5 sm:gap-3">
        {wings && <Wing gradientId="vv-wing-left" className={wingSize} />}
        <span
          className={`whitespace-nowrap font-display font-extrabold tracking-wide ${texto} ${
            large ? "text-2xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-3xl"
          }`}
        >
          VILLAGE <span className="text-brand-yellow">&amp;</span> VAULT
        </span>
        {/* Espelhada: a mesma asa, virada para a direita. */}
        {wings && (
          <span className="-scale-x-100">
            <Wing gradientId="vv-wing-right" className={`block ${wingSize}`} />
          </span>
        )}
      </Link>
      <p
        className={`mt-2 font-bold uppercase tracking-[0.22em] ${texto} ${
          large ? "text-[11px] sm:text-xs" : "text-[10px] sm:text-[11px]"
        }`}
      >
        Cartas · Selados · Colecionáveis
      </p>
    </div>
  );
}
