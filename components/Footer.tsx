import Image from "next/image";
import TrustBadges from "./TrustBadges";

export default function Footer() {
  return (
    <footer className="mt-10 text-[11px] text-muted">
      <TrustBadges />

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Image src="/logo.jpg" alt="Village & Vault TCG" width={28} height={28} className="rounded-full" />
            <p className="font-display text-sm tracking-wide text-gold">VILLAGE &amp; VAULT</p>
          </div>
          <p className="leading-relaxed">
            Cartas e produtos selados de Pokémon, Magic e outros TCGs, com condição e
            estoque verificados.
          </p>
        </div>

        <div>
          <p className="font-display mb-3 text-[11px] uppercase tracking-wide text-gold">
            Atendimento
          </p>
          <p className="leading-relaxed">
            Segunda a sábado, 09:00 - 20:00
            <br />
            contato@villageandvault.com.br
          </p>
        </div>

        <div>
          <p className="font-display mb-3 text-[11px] uppercase tracking-wide text-gold">
            Institucional
          </p>
          <ul className="space-y-1.5">
            <li>
              <a href="/faq" className="transition-colors hover:text-gold">
                Perguntas frequentes
              </a>
            </li>
            <li>
              <a href="/trocas" className="transition-colors hover:text-gold">
                Trocas e devoluções
              </a>
            </li>
          </ul>
        </div>
      </div>

      <p className="mx-auto max-w-7xl border-t border-card-border px-5 py-5 text-[9px] text-muted/70">
        Pokémon TCG, Magic: The Gathering, Yu-Gi-Oh!, One Piece Card Game e Disney Lorcana
        são marcas registradas de seus respectivos detentores. Village &amp; Vault não é afiliada
        a essas empresas.
      </p>
    </footer>
  );
}
