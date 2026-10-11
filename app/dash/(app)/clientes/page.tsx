"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Cliente, LiveResumo } from "@/lib/dash/api";
import type { Venda } from "@/lib/dash/calculos";
import { inteiro, reais, useDash } from "@/lib/dash/cliente";
import { usePeriodo } from "@/components/dash/Periodo";
import { Avatar, Kpi, Vazio } from "@/components/dash/ui";
import { BotaoRelatorio, relatorioDeClientes } from "@/components/dash/BotaoRelatorio";

// Clientes, como no Dash TCG: quanto cada cliente comprou somando as lives do
// período, com pago, pendente, itens, compras, lives, 1ª e última compra.
// Clique no cliente para ver as compras uma por uma.

type Compra = Venda & { showId: string; live: string | null };
const data = (ts: number) => new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function Clientes() {
  const { chamar, eu } = useDash();
  const { periodo, campos } = usePeriodo(["tudo", "30d", "mes"], "tudo");
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [compras, setCompras] = useState<Record<string, Compra[]>>({});
  const [lives, setLives] = useState(0);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setClientes(null);
    setCompras({});
    chamar<{ clientes: Cliente[] }>(`/api/dash/clientes?de=${periodo.de}&ate=${periodo.ate}`)
      .then((r) => setClientes(r.clientes))
      .catch((e) => setErro(String(e.message)));
    chamar<{ lives: LiveResumo[] }>(`/api/dash/lives?de=${periodo.de}&ate=${periodo.ate}`)
      // Só as lives do vendedor (os clientes são dele); as de outros vendedores
      // que o robô ou a extensão acompanharam não contam aqui.
      .then((r) => setLives(r.lives.filter((l) => (l.vendedor ?? "").toLowerCase() === eu.membro.conta.toLowerCase()).length))
      .catch(() => {});
  }, [chamar, periodo.de, periodo.ate]);

  const lista = useMemo(() => {
    const t = busca.trim().replace(/^@/, "").toLowerCase();
    return (clientes ?? []).filter((c) => !t || c.comprador.toLowerCase().includes(t));
  }, [clientes, busca]);

  const totalPago = (clientes ?? []).reduce((s, c) => s + c.pago, 0);
  const totalItens = (clientes ?? []).reduce((s, c) => s + c.itens, 0);

  async function abrir(handle: string) {
    if (aberto === handle) return setAberto(null);
    setAberto(handle);
    if (compras[handle]) return;
    const r = await chamar<{ compras: Compra[] }>(`/api/dash/clientes?handle=${encodeURIComponent(handle)}&de=${periodo.de}&ate=${periodo.ate}`);
    setCompras((c) => ({ ...c, [handle]: r.compras }));
  }

  return (
    <main className="d-page">
      <header>
        <h1 className="d-page-title">Clientes</h1>
        <p className="d-page-sub">Quanto cada cliente já comprou, somando todas as lives salvas do vendedor.</p>
      </header>

      <section className="d-card flex flex-wrap items-end gap-3 p-4">
        <label className="d-label flex flex-col gap-1.5">
          Vendedor
          <select className="d-field" value={eu.membro.conta} disabled>
            <option value={eu.membro.conta}>@{eu.membro.conta}</option>
          </select>
        </label>
        {campos}
        <input placeholder="Buscar @cliente" className="d-field w-full sm:w-48" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <BotaoRelatorio className="d-btn d-btn-primary ml-auto" preparar={relatorioDeClientes(eu.membro.conta, periodo.de, periodo.ate)}>
          Baixar PDF
        </BotaoRelatorio>
      </section>
      {erro && <p className="text-sm text-d-bad">{erro}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Clientes" valor={inteiro(clientes?.length ?? 0)} />
        <Kpi rotulo="Total pago" valor={reais(totalPago)} dinheiro />
        <Kpi rotulo="Itens" valor={inteiro(totalItens)} />
        <Kpi rotulo="Lives" valor={inteiro(lives)} />
      </div>

      <div className="d-card overflow-hidden">
        <div className="d-scroll overflow-x-auto">
          {clientes === null ? (
            <Vazio>Carregando…</Vazio>
          ) : lista.length ? (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="d-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-right font-semibold">Total pago</th>
                  <th className="px-4 py-3 text-right font-semibold">Pendente</th>
                  <th className="px-4 py-3 text-right font-semibold">Itens</th>
                  <th className="px-4 py-3 text-right font-semibold">Compras</th>
                  <th className="px-4 py-3 text-right font-semibold">Lives</th>
                  <th className="px-4 py-3 text-right font-semibold">1ª compra</th>
                  <th className="px-4 py-3 text-right font-semibold">Última</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-d-line">
                {lista.map((c, i) => (
                  <Fragment key={c.comprador}>
                    <tr onClick={() => abrir(c.comprador)} className="cursor-pointer hover:bg-d-panel2/60">
                      <td className="px-4 py-2.5 tabular-nums text-d-ink3">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar foto={c.foto} nome={c.comprador} tamanho={28} />
                          <span className="font-medium">@{c.comprador}</span>
                        </div>
                      </td>
                      <td className="dash-valor px-4 py-2.5 text-right font-bold tabular-nums text-d-ok">{reais(c.pago)}</td>
                      <td className="dash-valor px-4 py-2.5 text-right tabular-nums text-d-warn">{c.pendente > 0 ? reais(c.pendente) : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{inteiro(c.itens)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{inteiro(c.compras)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{inteiro(c.lives)}</td>
                      <td className="px-4 py-2.5 text-right text-d-ink2">{data(c.primeira)}</td>
                      <td className="px-4 py-2.5 text-right text-d-ink2">{data(c.ultima)}</td>
                    </tr>
                    {aberto === c.comprador && (
                      <tr className="bg-d-panel2/40">
                        <td colSpan={9} className="px-4 py-3">
                          {!compras[c.comprador] ? (
                            <p className="text-xs text-d-ink3">Carregando compras…</p>
                          ) : (
                            <ul className="divide-y divide-d-line">
                              {compras[c.comprador].map((v) => (
                                <li key={v.id} className={`flex items-center gap-3 py-1.5 text-xs ${v.cancelado ? "opacity-40 line-through" : ""}`}>
                                  <span className="w-20 text-d-ink3">{data(v.ts)}</span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {v.titulo}
                                    {v.quantidade > 1 ? ` · ${v.quantidade} un.` : ""}
                                  </span>
                                  <span className="hidden max-w-[240px] truncate text-d-ink3 md:block">{v.live}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.pago === false ? "bg-d-warn/15 text-d-warn" : "bg-d-ok/15 text-d-ok"}`}>
                                    {v.pago === false ? "Pendente" : "Paga"}
                                  </span>
                                  <span className="dash-valor w-24 text-right font-semibold tabular-nums">{reais(v.total)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <Vazio>Nenhum cliente {busca ? "com esse nome" : "neste período"}.</Vazio>
          )}
        </div>
      </div>
    </main>
  );
}
