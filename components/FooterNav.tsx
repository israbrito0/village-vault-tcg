import Link from "next/link";
import { GAMES } from "@/lib/types";

const SECONDARY_LINKS = [
  { label: "Acessórios", href: "/catalogo?subcategoria=colecionaveis" },
  { label: "Torneios", href: "/torneios" },
  { label: "Dúvidas frequentes", href: "/faq" },
];

export default function FooterNav() {
  return (
    <div className="bg-gold px-5 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-x-5 gap-y-1.5">
        {GAMES.map((game) => (
          <Link
            key={game.slug}
            href={`/catalogo?jogo=${game.slug}`}
            className="text-[11px] font-medium uppercase tracking-wide text-ink hover:underline"
          >
            {game.label}
          </Link>
        ))}
      </div>
      <div className="mx-auto mt-1.5 flex max-w-7xl flex-wrap gap-x-5 gap-y-1 border-t border-ink/15 pt-1.5">
        {SECONDARY_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-[10px] font-medium uppercase tracking-wide text-ink/80 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
