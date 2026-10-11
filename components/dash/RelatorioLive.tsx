"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { DashContexto } from "@/lib/dash/cliente";
import { relatorioDaApi, relatorioDeClientes, type Preparar } from "@/components/dash/BotaoRelatorio";

// Os relatórios em PDF, iguais aos do Dash TCG (lib/dash/pdf.ts): o da live,
// o do período e o de clientes. A página desenha o arquivo e mostra aqui
// mesmo, com o botão de baixar. Com ?imprimir=1 (os links antigos) ele já
// baixa sozinho.

const semLogin = <div className="flex min-h-screen items-center justify-center text-sm text-d-ink3">Entre no Dash neste navegador para ver o relatório.</div>;

function VisorPdf({ preparar, chave, titulo }: { preparar: Preparar; chave: string; titulo: string }) {
  const dash = useContext(DashContexto);
  const chamar = useRef(dash?.chamar);
  chamar.current = dash?.chamar;
  const montar = useRef(preparar);
  montar.current = preparar;
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
        const r = await montar.current(chamar.current!);
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
    // `chave` muda quando o relatório pedido muda (a função é nova a cada render).
  }, [token, chave]);

  if (!dash) return semLogin;
  return (
    <div className="flex h-screen flex-col bg-d-bg">
      <header className="flex flex-wrap items-center gap-3 border-b border-d-line bg-d-panel px-4 py-3">
        <p className="mr-auto text-sm font-semibold">{titulo}</p>
        {estado && (
          <span className="flex items-center gap-2 text-xs text-d-ink3">
            <Loader2 className="size-4 animate-spin" />
            {estado}
          </span>
        )}
        <button className="d-btn d-btn-primary" disabled={!url} onClick={() => pronto.current?.salvar()}>
          <Download className="size-4" /> Baixar PDF
        </button>
      </header>
      {url ? <iframe title={titulo} src={url} className="w-full flex-1 bg-white" /> : <div className="flex flex-1 items-center justify-center text-sm text-d-ink3">{estado}</div>}
    </div>
  );
}

export function RelatorioLive({ showId }: { showId: string }) {
  const endereco = `/api/dash/relatorio?show=${encodeURIComponent(showId)}`;
  return <VisorPdf titulo="Relatório da live" chave={endereco} preparar={relatorioDaApi(endereco)} />;
}

export function RelatorioPeriodo({ de, ate, busca = "" }: { de: number; ate: number; busca?: string }) {
  const endereco = `/api/dash/relatorio?de=${de}&ate=${ate}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`;
  return <VisorPdf titulo="Relatório do período" chave={endereco} preparar={relatorioDaApi(endereco)} />;
}

export function RelatorioClientes({ de, ate }: { de: number; ate: number }) {
  const conta = useContext(DashContexto)?.eu.membro.conta ?? "";
  const preparar = useMemo(() => relatorioDeClientes(conta, de, ate), [conta, de, ate]);
  return <VisorPdf titulo="Clientes" chave={`clientes:${conta}:${de}:${ate}`} preparar={preparar} />;
}
