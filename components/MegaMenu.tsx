import Link from "next/link";
import { LIVE_URL } from "@/lib/site";
import { GAMES, SUBCATEGORIES } from "@/lib/types";
import LiveLink from "./LiveLink";
import { ACCENT_BUTTON, BUTTON_BASE, accentAt } from "./ui";

const SECONDARY_LINKS = [
  { label: "Acessórios", href: "/catalogo?subcategoria=colecionaveis" },
  { label: "Torneios", href: "/torneios" },
  { label: "Dúvidas frequentes", href: "/faq" },
];

export default function MegaMenu() {
  return (
    <nav className="border-y border-card-border bg-white">
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-2.5 overflow-x-auto whitespace-nowrap px-5 py-3 sm:flex-wrap sm:justify-center sm:overflow-visible">
        {GAMES.map((game, i) => (
          <div key={game.slug} className="group relative shrink-0">
            <Link
              href={`/catalogo?jogo=${game.slug}`}
              className={`${BUTTON_BASE} ${ACCENT_BUTTON[accentAt(i)]} inline-flex items-center gap-1 px-3 py-1.5 text-[11px]`}
            >
              {game.label}
              <span className="hidden text-[9px] sm:inline">▾</span>
            </Link>
            {/* Abre com o mouse ou com Tab no teclado; o pt-1 evita que o menu feche no vão. */}
            <div className="absolute left-0 top-full z-20 hidden pt-1 sm:group-focus-within:block sm:group-hover:block">
              <div className="w-60 rounded border border-card-border bg-white py-2 text-left shadow-lg">
                {SUBCATEGORIES.map((sub) => (
                  <Link
                    key={sub.slug}
                    href={`/catalogo?jogo=${game.slug}&subcategoria=${sub.slug}`}
                    className="block px-4 py-2 text-xs text-ink/80 hover:bg-surface hover:text-brand-blue"
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-5 overflow-x-auto whitespace-nowrap border-t border-card-border px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted sm:justify-center sm:overflow-visible">
        {SECONDARY_LINKS.map((link) => (
          <Link key={link.label} href={link.href} className="shrink-0 transition-colors hover:text-ink">
            {link.label}
          </Link>
        ))}
        <LiveLink href={LIVE_URL} />
      </div>
    </nav>
  );
}
