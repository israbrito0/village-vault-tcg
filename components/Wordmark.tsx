import Link from "next/link";

// Nome da loja centralizado com o subtítulo, igual em todas as páginas.
export default function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <div className="text-center">
      <Link href="/" className="inline-block">
        <span
          className={`font-display font-semibold tracking-wide text-ink ${
            large ? "text-3xl sm:text-5xl" : "text-2xl sm:text-4xl"
          }`}
        >
          VILLAGE <span className="text-brand-yellow">&amp;</span> VAULT
        </span>
      </Link>
      <p
        className={`mt-2 font-bold uppercase tracking-[0.22em] text-ink ${
          large ? "text-[11px] sm:text-xs" : "text-[10px] sm:text-[11px]"
        }`}
      >
        Cartas · Selados · Colecionáveis
      </p>
    </div>
  );
}
