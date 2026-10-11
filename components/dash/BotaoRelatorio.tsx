"use client";

import { useContext, useState, type ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";
import type { Cliente, LiveResumo } from "@/lib/dash/api";
import { DashContexto } from "@/lib/dash/cliente";
import { montarRelatorio, montarRelatorioClientes, type EntradaRelatorio, type Relatorio } from "@/lib/dash/relatorio";

// "Baixar PDF" / "Baixar relatório do período": como no Dash TCG, o clique já
// baixa o arquivo (os dados vêm da API, o PDF é desenhado aqui no navegador).

type Chamar = <T>(caminho: string) => Promise<T>;
export type Preparar = (chamar: Chamar) => Promise<Relatorio>;

// Relatório da live (?show=) ou do período (?de=&ate=).
export const relatorioDaApi =
  (endereco: string): Preparar =>
  async (chamar) =>
    montarRelatorio(await chamar<EntradaRelatorio>(endereco));

// "Clientes de @conta": os clientes do período e quantas lives dele houve.
export const relatorioDeClientes =
  (conta: string, de: number, ate: number): Preparar =>
  async (chamar) => {
    const [c, l] = await Promise.all([
      chamar<{ clientes: Cliente[] }>(`/api/dash/clientes?de=${de}&ate=${ate}`),
      chamar<{ lives: LiveResumo[] }>(`/api/dash/lives?de=${de}&ate=${ate}`),
    ]);
    const proprias = l.lives.filter((x) => (x.vendedor ?? "").toLowerCase() === conta.toLowerCase()).length;
    return montarRelatorioClientes({ conta, clientes: c.clientes, lives: proprias, periodo: { de, ate } });
  };

export function BotaoRelatorio({
  endereco,
  preparar,
  className = "d-btn d-btn-primary",
  children,
}: {
  endereco?: string;
  preparar?: Preparar;
  className?: string;
  children: ReactNode;
}) {
  const dash = useContext(DashContexto);
  const [estado, setEstado] = useState("");
  const [erro, setErro] = useState("");

  async function baixar() {
    if (!dash || estado) return;
    setErro("");
    setEstado("Buscando os dados…");
    try {
      const montar = preparar ?? relatorioDaApi(endereco ?? "");
      const r = await montar(dash.chamar);
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
