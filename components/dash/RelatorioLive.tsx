"use client";

import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { engajamento, lerTermos, pontosDaLive, pontosPorPessoa, porIcone, porProduto, rankingCarpas, rankingCompradores, resumoVendas } from "@/lib/dash/calculos";
import type { Cliente, LiveResumo } from "@/lib/dash/api";
import { DashContexto, dataHora, duracao, inteiro, reais, useLiveDash } from "@/lib/dash/cliente";

// Os relatórios em PDF (Imprimir → Salvar como PDF): de uma live, do período
// e dos clientes. Folha branca, com as mesmas contas do painel. Com
// ?imprimir=1 a janela de impressão abre sozinha quando os dados chegam.

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

export function RelatorioLive({ showId }: { showId: string }) {
  const dash = useContext(DashContexto);
  const { dados: d, erro } = useLiveDash(showId, 0);
  const c = useMemo(() => {
    if (!d) return null;
    const resumo = resumoVendas(d.vendas);
    const gemas = d.emocoes.reduce((s, e) => s + e.gemas, 0);
    const carpas = rankingCarpas(d.emocoes, d.chat, lerTermos(d.termos));
    return {
      resumo,
      gemas,
      carpas,
      totalCarpas: carpas.reduce((s, p) => s + p.carpas, 0),
      compradores: rankingCompradores(d.vendas),
      produtos: porProduto(d.vendas, false),
      pontos: pontosPorPessoa(d.emocoes),
      icones: porIcone(d.emocoes),
      eng: engajamento(d.emocoes, d.chat, d.vendas),
      pontosLive: pontosDaLive(resumo.total, gemas, d.ranking?.regras),
    };
  }, [d]);
  useImprimirSozinho(!!c);
  if (!dash) return semLogin;
  if (!d || !c) return montando(erro);

  const live = d.live;
  const m = live.metricas ?? {};
  const vendido = Math.max(c.resumo.total, Number(m.faturamento) || 0);
  const fim = live.fim ?? d.vendas.at(-1)?.ts ?? null;
  return (
    <Folha titulo={live.titulo || "Live"} sub={`@${live.vendedor} · ${live.inicio ? dataHora(live.inicio) : "—"}${live.inicio && fim && fim > live.inicio ? ` · ${duracao(fim - live.inicio)}` : ""}`}>
      <Numeros
        itens={[
          ["Total vendido", reais(vendido)],
          ["Pago", reais(c.resumo.pago)],
          ["Pendente", reais(Math.max(0, vendido - c.resumo.pago))],
          ["Vendas", inteiro(c.resumo.vendas)],
          ["Itens", inteiro(Math.max(c.resumo.itens, Number(m.itensDashTCG) || 0))],
          ["Compradores", inteiro(Math.max(c.resumo.compradores, Number(m.compradores) || 0))],
          ["Ticket médio", reais(c.resumo.vendas ? c.resumo.total / c.resumo.vendas : 0)],
          ["Carpas douradas", inteiro(c.totalCarpas)],
          ["Emotions", `${inteiro(d.emocoes.length)} (${inteiro(c.gemas)} pts)`],
          ["Mensagens no chat", inteiro(d.chat.length)],
          ["Pico de espectadores", m.pico ? inteiro(Number(m.pico)) : live.pico ? inteiro(live.pico) : "—"],
          ["Pontos no ranking (≈)", inteiro(c.pontosLive)],
        ]}
      />
      <Tabela
        titulo="Vendidos por produto"
        cabecas={["Produto", "Qtd", "Vendas", "Compradores", "Preço médio", "Total"]}
        linhas={c.produtos.map((p) => [p.titulo, inteiro(p.qtd), inteiro(p.vendas), inteiro(p.compradores), reais(p.medio), reais(p.total)])}
      />
      <Tabela titulo="Compradores" cabecas={["Cliente", "Itens", "Compras", "Pago", "Total"]} linhas={c.compradores.map((p) => [`@${p.handle}`, inteiro(p.itens), inteiro(p.compras), reais(p.pago), reais(p.total)])} />
      <Tabela titulo="Ranking de carpas" cabecas={["Pessoa", "Carpas"]} linhas={c.carpas.slice(0, 40).map((p) => [`@${p.handle}`, inteiro(p.carpas)])} />
      <Tabela titulo="Emotions" cabecas={["Emotion", "Envios", "Pontos"]} linhas={c.icones.map((i) => [i.icone, inteiro(i.qtd), inteiro(i.gemas)])} />
      <Tabela titulo="Pontos por usuário" cabecas={["Pessoa", "Emotions", "Pontos"]} linhas={c.pontos.slice(0, 40).map((p) => [`@${p.handle}`, inteiro(p.emocoes), inteiro(p.gemas)])} />
      <Tabela
        titulo="Sorteios"
        cabecas={["Sorteio", "Prêmio", "Ganhador", "Bilhetes", "Quando"]}
        linhas={d.sorteios.flatMap((s) =>
          s.ganhadores.map((g) => [
            s.nome,
            s.premio ?? "—",
            `@${g.handle}${g.status !== "valido" ? ` (${g.status})` : g.presente === false ? " (ausente)" : ""}`,
            `${g.bilhetes}/${g.totalBilhetes || "?"}`,
            dataHora(g.ts),
          ]),
        )}
      />
      <Tabela
        titulo="Engajamento (top 40)"
        cabecas={["Pessoa", "Mensagens", "Emotions", "Compras", "Tempo ativo"]}
        linhas={c.eng.slice(0, 40).map((p) => [`@${p.handle}`, p.mensagens, p.emocoes, p.compras, duracao(p.ativoMs)])}
      />
    </Folha>
  );
}

export function RelatorioPeriodo({ de, ate }: { de: number; ate: number }) {
  const dash = useContext(DashContexto);
  const [lives, setLives] = useState<LiveResumo[] | null>(null);
  useEffect(() => {
    dash?.chamar<{ lives: LiveResumo[] }>(`/api/dash/lives?de=${de}&ate=${ate}`).then((r) => setLives(r.lives)).catch(() => setLives([]));
  }, [dash, de, ate]);
  useImprimirSozinho(!!lives);
  if (!dash) return semLogin;
  if (!lives) return montando();
  const soma = (k: keyof LiveResumo) => lives.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const periodo = `${de ? new Date(de).toLocaleDateString("pt-BR") : "início"} a ${new Date(ate - 1).toLocaleDateString("pt-BR")}`;
  return (
    <Folha titulo="Relatório do período" sub={`@${dash.eu.membro.conta} · ${periodo}`}>
      <Numeros
        itens={[
          ["Lives", inteiro(lives.length)],
          ["Vendido", reais(soma("total"))],
          ["Pago", reais(soma("pago"))],
          ["Itens", inteiro(soma("itens"))],
          ["Emotions", inteiro(soma("emocoes"))],
          ["Sorteios", inteiro(soma("ganhadores"))],
        ]}
      />
      <Tabela
        titulo="Lives"
        cabecas={["Live", "Data", "Vendido", "Pago", "Itens", "Compradores", "Emotions", "Sorteios"]}
        linhas={lives.map((l) => [l.titulo ?? "Live", dataHora(l.inicio), reais(l.total), reais(l.pago), inteiro(l.itens), inteiro(l.compradores), inteiro(l.emocoes), inteiro(l.ganhadores)])}
      />
    </Folha>
  );
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
