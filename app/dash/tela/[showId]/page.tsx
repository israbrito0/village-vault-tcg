import type { Metadata } from "next";
import SessaoOpcional from "@/components/dash/SessaoOpcional";
import { TelaCompartilhar } from "@/components/dash/TelaCompartilhar";

// Tela p/ compartilhar: sem menu, sem dados de venda. Abre com o login do Dash
// ou com o link com a chave (?k=), para o OBS.
export const metadata: Metadata = { title: "Tela da live", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Pagina({ params, searchParams }: { params: { showId: string }; searchParams: { k?: string } }) {
  return (
    <SessaoOpcional>
      <TelaCompartilhar showId={decodeURIComponent(params.showId)} chave={searchParams.k} />
    </SessaoOpcional>
  );
}
