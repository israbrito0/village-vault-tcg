import type { Metadata } from "next";
import SessaoOpcional from "@/components/dash/SessaoOpcional";
import { RelatorioLive } from "@/components/dash/RelatorioLive";

export const metadata: Metadata = { title: "Relatório da live", robots: { index: false, follow: false } };

export default function Pagina({ params }: { params: { showId: string } }) {
  return (
    <SessaoOpcional>
      <RelatorioLive showId={decodeURIComponent(params.showId)} />
    </SessaoOpcional>
  );
}
