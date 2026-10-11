"use client";

import { useContext, useState, type ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";
import { DashContexto } from "@/lib/dash/cliente";
import { montarRelatorio, type EntradaRelatorio } from "@/lib/dash/relatorio";

// "Baixar PDF" / "Baixar relatório do período": como no Dash TCG, o clique já
// baixa o arquivo (os dados vêm da API, o PDF é desenhado aqui no navegador).
export async function prepararRelatorio(chamar: <T>(caminho: string) => Promise<T>, endereco: string) {
  const entrada = await chamar<EntradaRelatorio>(endereco);
  return montarRelatorio(entrada);
}

export function BotaoRelatorio({ endereco, className = "d-btn d-btn-primary", children }: { endereco: string; className?: string; children: ReactNode }) {
  const dash = useContext(DashContexto);
  const [estado, setEstado] = useState("");
  const [erro, setErro] = useState("");

  async function baixar() {
    if (!dash || estado) return;
    setErro("");
    setEstado("Buscando os dados…");
    try {
      const r = await prepararRelatorio(dash.chamar, endereco);
      const { baixarPdf } = await import("@/lib/dash/pdf");
      await baixarPdf(r, setEstado);
    } catch (e) {
      setErro((e as Error).message || "não consegui gerar o PDF");
    } finally {
      setEstado("");
    }
  }

  return (
    <button type="button" className={className} onClick={baixar} disabled={!!estado} title={erro || undefined}>
      {estado ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {estado || (erro ? "Tentar de novo" : children)}
    </button>
  );
}
