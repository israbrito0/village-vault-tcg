"use client";

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import type { Cliente } from "@/lib/dash/api";
import { DashContexto, dataHora, inteiro, reais } from "@/lib/dash/cliente";
import { prepararRelatorio } from "@/components/dash/BotaoRelatorio";

// Os relatórios em PDF. O da live e o do período são desenhados como no Dash
// TCG (VisorPdf); o de clientes é a folha branca para imprimir (Imprimir →
// Salvar como PDF), que abre a janela de impressão sozinha com ?imprimir=1.

function useImprimirSozinho(pronto: boolean) {
  useEffect(() => {
    if (!pronto) return;
    if (new URLSearchParams(window.location.search).get("imprimir") !== "1") return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [pronto]);
}

function Folha({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e9eaee] py-6 print:bg-white print:py-0">
      <div className="dash-sem-impressao mx-auto mb-4 flex max-w-[900px] items-center gap-2 px-4">
        <button className="d-btn d-btn-primary" onClick={() => window.print()}>
          <Printer className="size-4" /> Salvar PDF
        </button>
        <span className="text-xs text-[#5b616b]">Na janela de impressão, escolha “Salvar como PDF”.</span>
      </div>
      <article className="mx-auto max-w-[900px] rounded-lg bg-white p-8 text-[#1f2430] shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-[#F4AF14] pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A6700]">Dash Village · Village &amp; Vault</p>
          <h1 className="mt-1 text-2xl font-extrabold">{titulo}</h1>
          <p className="mt-1 text-[12px] text-gray-500">{sub}</p>
        </header>
        {children}
        <p className="mt-8 text-center text-[10px] text-gray-400">Gerado em {dataHora(Date.now())} pelo Dash Village.</p>
      </article>
    </div>
  );
}

function Numeros({ itens }: { itens: [string, string][] }) {
  return (
    <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-3">
      {itens.map(([r, v]) => (
        <div key={r} className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-500">{r}</span>
          <b>{v}</b>
        </div>
      ))}
    </section>
  );
}

function Tabela({ titulo, cabecas, linhas }: { titulo: string; cabecas: string[]; linhas: (string | number)[][] }) {
  if (!linhas.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 border-b border-gray-300 pb-1 text-[13px] font-bold uppercase tracking-wider text-gray-700">{titulo}</h2>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-gray-500">
            {cabecas.map((c, i) => (
              <th key={c} className={`pb-1 font-semibold ${i ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="break-inside-avoid border-t border-gray-100">
              {l.map((v, j) => (
                <td key={j} className={`py-1 ${j ? "text-right" : ""}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const semLogin = <div className="flex min-h-screen items-center justify-center text-sm text-d-ink3">Entre no Dash neste navegador para ver o relatório.</div>;
const montando = (texto?: string) => <div className="flex min-h-screen items-center justify-center text-sm text-d-ink3">{texto || "Montando o relatório…"}</div>;

// O Relatório da live e o do período são PDFs iguais aos do Dash TCG
// (lib/dash/pdf.ts): a página desenha o arquivo e mostra aqui mesmo, com o
// botão de baixar. Com ?imprimir=1 (os links antigos) ele já baixa sozinho.
function VisorPdf({ endereco, titulo }: { endereco: string; titulo: string }) {
  const dash = useContext(DashContexto);
  const chamar = useRef(dash?.chamar);
  chamar.current = dash?.chamar;
  const token = dash?.token;
  const [estado, setEstado] = useState("Buscando os dados…");
  const [url, setUrl] = useState<string | null>(null);
  const pronto = useRef<{ salvar: () => void } | null>(null);

  useEffect(() => {
    if (!token || !chamar.current) return;
    let vivo = true;
    let endBlob = "";
    (async () => {
      try {
        const r = await prepararRelatorio(chamar.current!, endereco);
        const { gerarPdf } = await import("@/lib/dash/pdf");
        const doc = await gerarPdf(r, (t) => vivo && setEstado(t));
        if (!vivo) return;
        pronto.current = { salvar: () => doc.save(r.arquivo) };
        endBlob = URL.createObjectURL(doc.output("blob"));
        setUrl(endBlob);
        setEstado("");
        if (new URLSearchParams(window.location.search).get("imprimir") === "1") doc.save(r.arquivo);
      } catch (e) {
        if (vivo) setEstado((e as Error).message || "Não consegui montar o relatório.");
      }
    })();
    return () => {
      vivo = false;
      if (endBlob) URL.revokeObjectURL(endBlob);
    };
  }, [token, endereco]);

  if (!dash) return semLogin;
  return (
    <div className="flex h-screen flex-col bg-d-bg">
      <header className="flex flex-wrap items-center gap-3 border-b border-d-line bg-d-panel px-4 py-3">
        <p className="mr-auto text-sm font-semibold">{titulo}</p>
        {estado && <span className="flex items-center gap-2 text-xs text-d-ink3"><Loader2 className="size-4 animate-spin" />{estado}</span>}
        <button className="d-btn d-btn-primary" disabled={!url} onClick={() => pronto.current?.salvar()}>
          <Download className="size-4" /> Baixar PDF
        </button>
      </header>
      {url ? <iframe title={titulo} src={url} className="w-full flex-1 bg-white" /> : <div className="flex flex-1 items-center justify-center text-sm text-d-ink3">{estado}</div>}
    </div>
  );
}

export function RelatorioLive({ showId }: { showId: string }) {
  return <VisorPdf titulo="Relatório da live" endereco={`/api/dash/relatorio?show=${encodeURIComponent(showId)}`} />;
}

export function RelatorioPeriodo({ de, ate, busca = "" }: { de: number; ate: number; busca?: string }) {
  return <VisorPdf titulo="Relatório do período" endereco={`/api/dash/relatorio?de=${de}&ate=${ate}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`} />;
}

export function RelatorioClientes({ de, ate }: { de: number; ate: number }) {
  const dash = useContext(DashContexto);
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  useEffect(() => {
    dash?.chamar<{ clientes: Cliente[] }>(`/api/dash/clientes?de=${de}&ate=${ate}`).then((r) => setClientes(r.clientes)).catch(() => setClientes([]));
  }, [dash, de, ate]);
  useImprimirSozinho(!!clientes);
  if (!dash) return semLogin;
  if (!clientes) return montando();
  const data = (ts: number) => new Date(ts).toLocaleDateString("pt-BR");
  return (
    <Folha titulo="Clientes" sub={`@${dash.eu.membro.conta} · ${de ? data(de) : "início"} a ${data(ate - 1)}`}>
      <Numeros
        itens={[
          ["Clientes", inteiro(clientes.length)],
          ["Total pago", reais(clientes.reduce((s, c) => s + c.pago, 0))],
          ["Pendente", reais(clientes.reduce((s, c) => s + c.pendente, 0))],
          ["Itens", inteiro(clientes.reduce((s, c) => s + c.itens, 0))],
        ]}
      />
      <Tabela
        titulo="Clientes"
        cabecas={["Cliente", "Total pago", "Pendente", "Itens", "Compras", "Lives", "1ª compra", "Última"]}
        linhas={clientes.map((c) => [`@${c.comprador}`, reais(c.pago), c.pendente ? reais(c.pendente) : "—", inteiro(c.itens), inteiro(c.compras), inteiro(c.lives), data(c.primeira), data(c.ultima)])}
      />
    </Folha>
  );
}
