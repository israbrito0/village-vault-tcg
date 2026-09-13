import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";
import PainelLeilao from "@/components/PainelLeilao";

// Página privada do leiloeiro: fora do menu, fora do sitemap, sem indexação.
export const metadata: Metadata = {
  title: "Painel do leilão",
  robots: { index: false, follow: false },
};

export default function PainelLeilaoPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <PageTitle title="Painel do leilão" />
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-ink/80">
        Cadastre a carta pelo código, abra o lote e acompanhe os lances.
      </p>
      <div className="mt-6">
        <PainelLeilao />
      </div>
    </main>
  );
}
