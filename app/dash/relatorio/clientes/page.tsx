import type { Metadata } from "next";
import SessaoOpcional from "@/components/dash/SessaoOpcional";
import { RelatorioClientes } from "@/components/dash/RelatorioLive";

export const metadata: Metadata = { title: "Relatório de clientes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Pagina({ searchParams }: { searchParams: { de?: string; ate?: string } }) {
  return (
    <SessaoOpcional>
      <RelatorioClientes de={Number(searchParams.de) || 0} ate={Number(searchParams.ate) || 0} />
    </SessaoOpcional>
  );
}
