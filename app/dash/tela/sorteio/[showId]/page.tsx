import type { Metadata } from "next";
import SessaoOpcional from "@/components/dash/SessaoOpcional";
import { TelaSorteio } from "@/components/dash/TelaSorteio";

// Um sorteio em tela cheia (16:9 ou 9:16) para o OBS. ?k= é a chave da conta,
// ?s= o sorteio e ?fundo=transparente|verde para recortar no OBS.
export const metadata: Metadata = { title: "Sorteio", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Pagina({ params, searchParams }: { params: { showId: string }; searchParams: { k?: string; s?: string; fundo?: string } }) {
  return (
    <SessaoOpcional fundo={searchParams.fundo}>
      <TelaSorteio showId={decodeURIComponent(params.showId)} sorteioId={searchParams.s} chave={searchParams.k} />
    </SessaoOpcional>
  );
}
