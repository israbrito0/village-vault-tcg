"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Radio, Trophy } from "lucide-react";
import { haQuanto, inteiro, reais, useAgora, useDash } from "@/lib/dash/cliente";
import { Avatar, Kpi, Vazio } from "@/components/dash/ui";

// Faturamento da Jamble inteira, por mês: quanto cada vendedor vendeu e quanto
// cada comprador gastou, somado das listas de vendidos de cada live (vendas
// pagas, sem canceladas). O coletor lê sem parar e a página se atualiza sozinha.

type Vendedor = {
  id: string;
  handle: string;
  foto: string | null;
  vendido: number;
  vendas: number;
  itens: number;
  lives: number;
  porLive: number;
  posicaoPontos: number | null;
  pontos: number | null;
  parcialDesde: number | null;
  noAr: boolean;
  pendentes: number;
};
type Comprador = {
  chave: string;
  handle: string;
  foto: string | null;
  total: number;
  compras: number;
  itens: number;
  vendedores: number;
  lives: number;
  onde: string | null;
  ondeValor: number;
  comigo: number;
  ultima: number | null;
};
type Base = { meses: string[]; mes: string; conta: string; atualizadoEm: number | null };
type RespVendedores = Base & { aba: "vendedores"; temPontos: boolean; total: number; vendedores: Vendedor[] };
type RespCompradores = Base & { aba: "compradores"; livesFaltando: number; compradores: Comprador[] };

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (m: string) => {
  const [a, n] = m.split("-").map(Number);
  return `${NOMES[n - 1][0].toUpperCase()}${NOMES[n - 1].slice(1)} ${a}`;
};
const diaMes = (ts: number) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const POR_VEZ = 200;

export default function Faturamento() {
  const { chamar } = useDash();
  const agora = useAgora(10000);
  const [mes, setMes] = useState<string | null>(null);
  const [aba, setAba] = useState<"vendedores" | "compradores">("vendedores");
  const [vend, setVend] = useState<RespVendedores | null>(null);
  const [comp, setComp] = useState<RespCompradores | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "nunca" | "ja">("todos");
  const [mostrar, setMostrar] = useState(POR_VEZ);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const q = `?aba=${aba}${mes ? `&mes=${mes}` : ""}`;
      if (aba === "vendedores") setVend(await chamar<RespVendedores>(`/api/dash/faturamento${q}`));
      else setComp(await chamar<RespCompradores>(`/api/dash/faturamento${q}`));
      setErro("");
    } catch (e) {
      setErro(String((e as Error).message));
    }
  }, [chamar, aba, mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  // Em tempo real: a cada minuto, com a aba do navegador aberta.
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) carregar();
    }, 60000);
    return () => clearInterval(t);
  }, [carregar]);
  useEffect(() => setMostrar(POR_VEZ), [aba, mes, busca, filtro]);

  const dados = aba === "vendedores" ? vend : comp;
  const atual = dados?.mes ?? mes;
  const conta = (dados?.conta ?? "").toLowerCase();
  const termo = busca.trim().replace(/^@/, "").toLowerCase();

  const vendedores = useMemo(() => (vend?.vendedores ?? []).map((v, i) => ({ ...v, pos: i + 1 })), [vend]);
  const eu = vendedores.find((v) => v.handle.toLowerCase() === conta);
  const acima = eu && eu.pos > 1 ? vendedores[eu.pos - 2] : null;
  const abaixo = eu ? vendedores[eu.pos] : null;
  const listaV = vendedores.filter((v) => !termo || v.handle.toLowerCase().includes(termo));

  const compradores = useMemo(() => (comp?.compradores ?? []).map((c, i) => ({ ...c, pos: i + 1 })), [comp]);
  const top100 = compradores.slice(0, 100);
  const meusNoTop = top100.filter((c) => c.comigo > 0).length;
  const totalComp = compradores.reduce((t, c) => t + c.total, 0);
  const listaC = compradores.filter(
    (c) => (!termo || c.handle.toLowerCase().includes(termo)) && (filtro === "todos" || (filtro === "ja" ? c.comigo > 0 : c.comigo === 0)),
  );

  return (
    <main className="d-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="d-page-title">Faturamento da Jamble</h1>
          <p className="d-page-sub">
            Quanto cada vendedor faturou e quanto cada comprador gastou no mês, na Jamble inteira: vendas pagas das listas de vendidos de cada live, sem as canceladas.
          </p>
        </div>
        <input
          placeholder={aba === "vendedores" ? "Buscar @vendedor" : "Buscar @comprador"}
          className="d-field w-full sm:w-64"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </header>

      <section className="d-card flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <button className={`d-chip ${aba === "vendedores" ? "d-chip-on" : ""}`} onClick={() => setAba("vendedores")}>
            Vendedores
          </button>
          <button className={`d-chip ${aba === "compradores" ? "d-chip-on" : ""}`} onClick={() => setAba("compradores")}>
            Compradores
          </button>
          <span className="mx-1 w-px self-stretch bg-d-line" />
          {(dados?.meses ?? []).map((m) => (
            <button key={m} className={`d-chip ${atual === m ? "d-chip-on" : ""}`} onClick={() => setMes(m)}>
              {nomeDoMes(m)}
            </button>
          ))}
        </div>
        <p className="ml-auto inline-flex items-center gap-1.5 text-xs text-d-ink3">
          <span className="size-2 animate-pulse rounded-full bg-d-ok" />
          Atualiza sozinho a cada minuto{dados?.atualizadoEm ? ` · última leitura da Jamble ${haQuanto(dados.atualizadoEm, agora)}` : ""}
        </p>
      </section>
      {erro && <p className="text-sm text-d-bad">{erro}</p>}

      {aba === "vendedores" ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi rotulo={`Jamble inteira em ${atual ? nomeDoMes(atual).split(" ")[0].toLowerCase() : "…"}`} valor={vend ? reais(vend.total) : "—"} dinheiro />
            <Kpi rotulo={`Sua posição (@${vend?.conta ?? ""})`} valor={eu ? `#${eu.pos} de ${inteiro(vendedores.length)}` : "—"} cor="text-d-gold" />
            <Kpi rotulo="Seu faturamento" valor={eu ? reais(eu.vendido) : "—"} dinheiro />
            <Kpi
              rotulo={acima ? `Para passar @${acima.handle}` : abaixo ? `Sua vantagem sobre @${abaixo.handle}` : "Liderança"}
              valor={acima && eu ? reais(acima.vendido - eu.vendido) : abaixo && eu ? reais(eu.vendido - abaixo.vendido) : "—"}
              dinheiro
            />
          </div>
          <div className="d-card overflow-hidden">
            <div className="d-scroll overflow-x-auto">
              {!vend ? (
                <Vazio>Lendo o faturamento…</Vazio>
              ) : listaV.length ? (
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="d-table-head">
                    <tr>
                      <th className="w-14 px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Vendedor</th>
                      <th className="px-4 py-3 text-right font-semibold">Faturamento</th>
                      <th className="px-4 py-3 text-right font-semibold">Vendas</th>
                      <th className="px-4 py-3 text-right font-semibold">Lives</th>
                      <th className="px-4 py-3 text-right font-semibold" title="Faturamento dividido pelas lives do mês">
                        Por live
                      </th>
                      {vend.temPontos && <th className="px-4 py-3 text-right font-semibold">Nos pontos</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-d-line">
                    {listaV.slice(0, mostrar).map((v) => {
                      const sou = v.handle.toLowerCase() === conta;
                      return (
                        <tr key={v.id} className={sou ? "bg-d-brand/10" : "hover:bg-d-panel2/60"}>
                          <td className={`px-4 py-2.5 font-bold tabular-nums ${v.pos <= 3 ? "text-d-gold" : "text-d-ink3"}`}>
                            {v.pos <= 3 ? <Trophy className="mr-1 inline size-3.5" /> : null}
                            {v.pos}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar foto={v.foto} nome={v.handle} tamanho={30} />
                              <span className="font-medium">@{v.handle}</span>
                              {sou && <span className="rounded-full bg-d-brand/15 px-2 py-0.5 text-[10px] font-semibold text-d-brand">você</span>}
                              {v.noAr && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-d-bad/15 px-2 py-0.5 text-[10px] font-semibold text-d-bad" title="Live no ar agora: o faturamento ainda está subindo">
                                  <Radio className="size-3" />
                                  no ar
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="dash-valor px-4 py-2.5 text-right tabular-nums">
                            <span className="inline-flex flex-col items-end">
                              <span className="font-semibold text-d-ok">{reais(v.vendido)}</span>
                              {v.parcialDesde ? (
                                <span className="text-[10px] font-medium text-d-warn" title="A Jamble só mostra as 20 lives mais recentes de cada vendedor: as lives antes desta data não entraram na soma.">
                                  incompleto · só desde {diaMes(v.parcialDesde)}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{inteiro(v.vendas)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{inteiro(v.lives)}</td>
                          <td className="dash-valor px-4 py-2.5 text-right tabular-nums text-d-ink2">{v.lives ? reais(v.porLive) : "—"}</td>
                          {vend.temPontos && <td className="px-4 py-2.5 text-right tabular-nums text-d-ink3">{v.posicaoPontos ? `#${v.posicaoPontos}` : "—"}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <Vazio>{busca ? "Nenhum vendedor com esse nome." : "Ainda sem vendas lidas neste mês."}</Vazio>
              )}
            </div>
            {listaV.length > mostrar && (
              <div className="border-t border-d-line p-3 text-center">
                <button className="d-btn d-btn-secondary" onClick={() => setMostrar(mostrar + POR_VEZ)}>
                  Mostrar mais ({inteiro(listaV.length - mostrar)} restantes)
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {comp && comp.livesFaltando > 0 && (
            <p className="rounded-xl border border-d-warn/40 bg-d-warn/10 px-4 py-2.5 text-xs text-d-warn">
              Lendo os compradores: {inteiro(comp.livesFaltando)} lives na fila. Os números sobem conforme elas são lidas, e a página se atualiza sozinha.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi rotulo="Compradores no mês" valor={comp ? inteiro(compradores.length) : "—"} />
            <Kpi rotulo="Gasto por eles" valor={comp ? reais(totalComp) : "—"} dinheiro />
            <Kpi rotulo="Do top 100, já compraram de você" valor={comp ? `${meusNoTop} de ${Math.min(100, compradores.length)}` : "—"} cor="text-d-gold" />
            <Kpi rotulo="Top 10 = % de tudo" valor={comp && totalComp ? `${((100 * compradores.slice(0, 10).reduce((t, c) => t + c.total, 0)) / totalComp).toFixed(1).replace(".", ",")}%` : "—"} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className={`d-chip ${filtro === "todos" ? "d-chip-on" : ""}`} onClick={() => setFiltro("todos")}>
              Todos
            </button>
            <button className={`d-chip ${filtro === "nunca" ? "d-chip-on" : ""}`} onClick={() => setFiltro("nunca")}>
              Ainda não compraram de você
            </button>
            <button className={`d-chip ${filtro === "ja" ? "d-chip-on" : ""}`} onClick={() => setFiltro("ja")}>
              Já compraram de você
            </button>
          </div>
          <div className="d-card overflow-hidden">
            <div className="d-scroll overflow-x-auto">
              {!comp ? (
                <Vazio>Lendo os compradores…</Vazio>
              ) : listaC.length ? (
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="d-table-head">
                    <tr>
                      <th className="w-14 px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Comprador</th>
                      <th className="px-4 py-3 text-right font-semibold">Gastou</th>
                      <th className="px-4 py-3 text-right font-semibold">Compras</th>
                      <th className="px-4 py-3 text-right font-semibold" title="De quantos vendedores diferentes comprou">
                        Vendedores
                      </th>
                      <th className="px-4 py-3 font-semibold">Onde mais gastou</th>
                      <th className="px-4 py-3 text-right font-semibold">Com você</th>
                      <th className="px-4 py-3 text-right font-semibold">Última compra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-d-line">
                    {listaC.slice(0, mostrar).map((c) => (
                      <tr key={c.chave} className={c.comigo > 0 ? "bg-d-brand/5" : "hover:bg-d-panel2/60"}>
                        <td className={`px-4 py-2.5 font-bold tabular-nums ${c.pos <= 3 ? "text-d-gold" : "text-d-ink3"}`}>
                          {c.pos <= 3 ? <Trophy className="mr-1 inline size-3.5" /> : null}
                          {c.pos}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar foto={c.foto} nome={c.handle} tamanho={30} />
                            <span className="font-medium">@{c.handle}</span>
                          </div>
                        </td>
                        <td className="dash-valor px-4 py-2.5 text-right font-semibold tabular-nums text-d-ok">{reais(c.total)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{inteiro(c.compras)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{inteiro(c.vendedores)}</td>
                        <td className="px-4 py-2.5 text-d-ink2">
                          {c.onde ? (
                            <>
                              @{c.onde} <span className="dash-valor text-xs text-d-ink3">· {reais(c.ondeValor)}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`dash-valor px-4 py-2.5 text-right tabular-nums ${c.comigo > 0 ? "font-semibold text-d-brand" : "text-d-ink3"}`}>
                          {c.comigo > 0 ? reais(c.comigo) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-d-ink3">{c.ultima ? diaMes(c.ultima) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Vazio>{busca ? "Nenhum comprador com esse nome." : "Ainda sem compradores lidos neste mês."}</Vazio>
              )}
            </div>
            {listaC.length > mostrar && (
              <div className="border-t border-d-line p-3 text-center">
                <button className="d-btn d-btn-secondary" onClick={() => setMostrar(mostrar + POR_VEZ)}>
                  Mostrar mais ({inteiro(listaC.length - mostrar)} restantes)
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-d-ink3">
        Como é contado: cada live tem uma lista de vendidos aberta a qualquer visitante, com o preço, quem comprou, se foi pago e se foi cancelado. O Dash soma só as vendas
        pagas e não canceladas, no mês em que aconteceram (horário de Brasília). As lives no ar são relidas a cada 10 minutos e as que acabaram há menos de 4 dias, a
        cada 3 horas, para pegar pagamentos que entram depois. Toda live que entra no ar é registrada; das mais antigas, a Jamble só mostra as 20 mais recentes de cada
        vendedor, por isso alguns vendedores de setembro aparecem como incompletos.
      </p>
    </main>
  );
}
