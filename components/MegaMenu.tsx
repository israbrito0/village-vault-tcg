import Link from "next/link";
import { GAMES, SUBCATEGORIES } from "@/lib/types";

const SECONDARY_LINKS = [
  { label: "Acessórios", href: "/catalogo?subcategoria=colecionaveis" },
  { label: "Torneios", href: "/torneios" },
  { label: "Dúvidas frequentes", href: "/faq" },
];

export default function MegaMenu() {
  return (
    <nav className="relative border-y border-card-border bg-white">
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-5 overflow-x-auto whitespace-nowrap px-5 py-3 text-sm font-bold tracking-wide text-ink sm:flex-wrap sm:overflow-visible">
        {GAMES.map((game) => (
          <div key={game.slug} className="group relative shrink-0">
            <Link
              href={`/catalogo?jogo=${game.slug}`}
              className="flex items-center gap-1 uppercase transition-colors hover:text-brand-blue"
            >
              {game.label}
              <span className="hidden text-[9px] sm:inline">▾</span>
            </Link>
            {/* Abre com o mouse ou com Tab no teclado. */}
            <div className="absolute left-0 top-full z-20 hidden w-64 border border-card-border bg-card py-2 shadow-lg sm:group-focus-within:block sm:group-hover:block">
              {SUBCATEGORIES.map((sub) => (
                <Link
                  key={sub.slug}
                  href={`/catalogo?jogo=${game.slug}&subcategoria=${sub.slug}`}
                  className="block px-4 py-2 text-[11px] text-cream/80 hover:bg-surface hover:text-gold-deep"
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-4 overflow-x-auto whitespace-nowrap border-t border-card-border px-5 py-2 text-xs font-medium text-muted sm:flex-wrap sm:overflow-visible">
        {SECONDARY_LINKS.map((link) => (
          <Link key={link.label} href={link.href} className="shrink-0 transition-colors hover:text-brand-green">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
