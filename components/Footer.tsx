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
      <div className="mx-auto flex max-w-7xl flex-wrap gap-5 px-5 py-2.5 text-[11px] font-medium tracking-wide text-ink">
        {GAMES.map((game) => (
          <div
            key={game.slug}
            className="relative"
            onMouseEnter={() => setOpenGame(game.slug)}
            onMouseLeave={() => setOpenGame(null)}
          >
            <Link
              href={`/catalogo?jogo=${game.slug}`}
              className="flex items-center gap-1 uppercase hover:underline"
            >
              {game.label}
              <span className="text-[9px]">▾</span>
            </Link>
            {openGame === game.slug && (
              <div className="absolute left-0 top-full z-20 w-64 border border-card-border bg-card py-2 shadow-lg">
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
      <div className="mx-auto flex max-w-7xl flex-wrap gap-4 border-t border-ink/15 px-5 py-2 text-[10px] font-medium text-ink/80">
        {SECONDARY_LINKS.map((link) => (
          <Link key={link.label} href={link.href} className="hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
