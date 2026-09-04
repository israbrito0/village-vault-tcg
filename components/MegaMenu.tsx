"use client";

import Link from "next/link";
import { useState } from "react";
import { GAMES, SUBCATEGORIES } from "@/lib/types";

const SECONDARY_LINKS = [
  { label: "Acessórios", href: "/catalogo?subcategoria=colecionaveis" },
  { label: "Torneios", href: "/torneios" },
  { label: "Dúvidas frequentes", href: "/faq" },
];

export default function MegaMenu() {
  const [openGame, setOpenGame] = useState<string | null>(null);

  return (
    <nav className="relative bg-gold">
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-5 overflow-x-auto whitespace-nowrap px-5 py-3 text-sm font-semibold tracking-wide text-ink sm:flex-wrap sm:overflow-visible">
        {GAMES.map((game) => (
          <div
            key={game.slug}
            className="relative shrink-0"
            onMouseEnter={() => setOpenGame(game.slug)}
            onMouseLeave={() => setOpenGame(null)}
          >
            <Link
              href={`/catalogo?jogo=${game.slug}`}
              className="flex items-center gap-1 uppercase hover:underline"
            >
              {game.label}
              <span className="hidden text-[9px] sm:inline">▾</span>
            </Link>
            {openGame === game.slug && (
              <div className="absolute left-0 top-full z-20 hidden w-64 border border-card-border bg-card py-2 shadow-lg sm:block">
                {SUBCATEGORIES.map((sub) => (
                  <Link
                    key={sub.slug}
                    href={`/catalogo?jogo=${game.slug}&subcategoria=${sub.slug}`}
                    className="block px-4 py-2 text-[11px] text-cream/80 hover:bg-ink hover:text-gold"
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-4 overflow-x-auto whitespace-nowrap border-t border-ink/15 px-5 py-2 text-xs font-medium text-ink/80 sm:flex-wrap sm:overflow-visible">
        {SECONDARY_LINKS.map((link) => (
          <Link key={link.label} href={link.href} className="shrink-0 hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
