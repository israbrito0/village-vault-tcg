import type { Metadata } from "next";
import SessaoOpcional from "@/components/dash/SessaoOpcional";
import { RelatorioPeriodo } from "@/components/dash/RelatorioLive";

export const metadata: Metadata = { title: "Relatório do período", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Pagina({ searchParams }: { searchParams: { de?: string; ate?: string; q?: string } }) {
  return (
    <SessaoOpcional>
      <RelatorioPeriodo de={Number(searchParams.de) || 0} ate={Number(searchParams.ate) || 0} busca={searchParams.q ?? ""} />
    </SessaoOpcional>
  );
}
