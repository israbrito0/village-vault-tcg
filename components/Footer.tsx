import TrustBadges from "./TrustBadges";

export default function Footer() {
  return (
    <footer className="mt-10 text-[11px] text-muted">
      <TrustBadges />
      <div className="mx-auto max-w-7xl grid gap-6 px-5 py-8 sm:grid-cols-3">
        <div>
          <p className="font-display mb-2 text-gold">VILLAGE &amp; VAULT</p>
          <p>Cartas e produtos selados de Pokémon, Magic e outros TCGs.</p>
        </div>
        <div>
          <p className="mb-2 text-cream/80">Atendimento</p>
          <p>Segunda a sábado, 09:00 - 20:00</p>
          <p>contato@villageandvault.com.br</p>
        </div>
        <div>
          <p className="mb-2 text-cream/80">Institucional</p>
          <p>Perguntas frequentes</p>
          <p>Trocas e devoluções</p>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-7xl text-[9px] text-muted/70">
        Pokémon TCG, Magic: The Gathering, Yu-Gi-Oh!, One Piece Card Game e Disney Lorcana
        são marcas registradas de seus respectivos detentores. Village &amp; Vault não é afiliada
        a essas empresas.
      </p>
    </footer>
  );
}
