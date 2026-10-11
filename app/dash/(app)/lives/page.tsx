"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LiveResumo } from "@/lib/dash/api";
import { dataHora, inteiro, reais, useDash } from "@/lib/dash/cliente";
import { usePeriodo } from "@/components/dash/Periodo";
import { Avatar, StatusLive, Vazio } from "@/components/dash/ui";

// Lives & Relatórios, como no Dash TCG: filtro, período, totais e a tabela com
// "Abrir" e "Baixar PDF" em cada live.
export default function Lives() {
  const { chamar } = useDash();
  const { periodo, campos } = usePeriodo(["hoje", "ontem", "7d", "mes", "tudo"], "tudo");
  const [lives, setLives] = useState<LiveResumo[] | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    setLives(null);
    chamar<{ lives: LiveResumo[] }>(`/api/dash/lives?de=${periodo.de}&ate=${periodo.ate}`)
      .then((r) => setLives(r.lives))
      .catch((e) => setErro(String(e.message)));
  }, [chamar, periodo.de, periodo.ate]);

  const lista = useMemo(() => {
    const t = busca.trim().replace(/^@/, "").toLowerCase();
    return (lives ?? []).filter((l) => !t || (l.titulo ?? "").toLowerCase().includes(t) || (l.vendedor ?? "").toLowerCase().includes(t));
  }, [lives, busca]);
  const total = lista.reduce((s, l) => s + l.total, 0);
  const itens = lista.reduce((s, l) => s + l.itens, 0);

  return (
    <main className="d-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="d-page-title">Lives &amp; Relatórios</h1>
          <p className="d-page-sub">Todas as lives salvas no banco. Baixe o relatório em PDF de cada uma.</p>
        </div>
        <input placeholder="Filtrar por @vendedor ou título" className="d-field w-full sm:w-72" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </header>

      <section className="d-card flex flex-wrap items-end gap-3 p-4">
        {campos}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <p className="text-right text-xs text-d-ink3">
            {inteiro(lista.length)} lives · <span className="dash-valor font-semibold text-d-ok">{reais(total)}</span> · {inteiro(itens)} itens
          </p>
          <Link className="d-btn d-btn-primary" target="_blank" href={`/dash/relatorio/periodo?de=${periodo.de}&ate=${periodo.ate}&imprimir=1`}>
            Baixar relatório do período
          </Link>
        </div>
      </section>
      {erro && <p className="text-sm text-d-bad">{erro}</p>}

      <div className="d-card overflow-hidden">
        <div className="d-scroll overflow-x-auto">
          {lives === null ? (
            <Vazio>Carregando…</Vazio>
          ) : lista.length ? (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="d-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">Live</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 text-right font-semibold">Vendido</th>
                  <th className="px-4 py-3 text-right font-semibold">Itens</th>
                  <th className="px-4 py-3 text-right font-semibold">Compradores</th>
                  <th className="px-4 py-3 text-right font-semibold">Emotions</th>
                  <th className="px-4 py-3 text-right font-semibold">Sorteios</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-d-line">
                {lista.map((l) => (
                  <tr key={l.showId} className="hover:bg-d-panel2/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar foto={l.vendedorFoto} nome={l.vendedor} tamanho={34} />
                        <div className="min-w-0">
                          <p className="max-w-[260px] truncate font-semibold">{l.titulo || "Live"}</p>
                          <p className="flex items-center gap-2 text-xs text-d-ink3">
                            @{l.vendedor} {l.aoVivo && <StatusLive aoVivo />}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-d-ink2">{dataHora(l.inicio)}</td>
                    <td className="dash-valor px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold text-d-ok">{reais(l.total)}</span>
                      <span className="block text-xs text-d-ink3">pago {reais(l.pago)}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{inteiro(l.itens)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inteiro(l.compradores)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inteiro(l.emocoes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inteiro(l.ganhadores)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link className="d-btn d-btn-secondary d-btn-sm" href={`/dash/painel/${encodeURIComponent(l.showId)}`}>
                          Abrir
                        </Link>
                        <Link className="d-btn d-btn-primary d-btn-sm" target="_blank" href={`/dash/relatorio/${encodeURIComponent(l.showId)}?imprimir=1`}>
                          Baixar PDF
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Vazio>Nenhuma live neste período.</Vazio>
          )}
        </div>
      </div>
    </main>
  );
}
