import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";
import LeilaoAoVivo from "@/components/LeilaoAoVivo";

export const metadata: Metadata = {
  title: "Leilões ao vivo",
  description: "Leilão ao vivo da Village & Vault TCG: lote aberto, lance em tempo real e chat com a galera.",
};

export default function LeiloesPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <PageTitle title="Leilões ao vivo" />
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-ink/80">
        O lote abre, o relógio corre e quem der o maior lance leva. Lance nos segundos finais estica o
        tempo, para ninguém ganhar no susto.
      </p>
      <div className="mt-6">
        <LeilaoAoVivo />
      </div>
    </main>
  );
}
