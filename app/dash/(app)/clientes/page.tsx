"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Printer, Search } from "lucide-react";
import type { Cliente } from "@/lib/dash/api";
import type { Venda } from "@/lib/dash/calculos";
import { dataHora, inteiro, reais, useDash } from "@/lib/dash/cliente";
import { usePeriodo } from "@/components/dash/Periodo";
import { Avatar, Botao, Cartao, campo, Kpi, Selo, Vazio } from "@/components/dash/ui";

// Clientes: quanto cada um comprou nas suas lives, pago e pendente, quantas
// lives e quando foi a primeira e a última compra. Clique para ver as compras.

type Compra = Venda & { showId: string; live: string | null };
type Ordem = "total" | "pendente" | "itens" | "lives" | "ultima";

export default function Clientes() {
  const { chamar } = useDash();
  const { periodo, seletor } = usePeriodo("tudo");
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("total");
  const [aberto, setAberto] = useState<string | null>(null);
  const [compras, setCompras] = useState<Record<string, Compra[]>>({});
  const [erro, setErro] = useState("");

  useEffect(() => {
    setClientes(null);
    setCompras({});
    chamar<{ clientes: Cliente[] }>(`/api/dash/clientes?de=${periodo.de}&ate=${periodo.ate}`)
      .then((r) => setClientes(r.clientes))
      .catch((e) => setErro(String(e.message)));
  }, [chamar, periodo.de, periodo.ate]);

  const lista = useMemo(() => {
    const t = busca.trim().replace(/^@/, "").toLowerCase();
    return (clientes ?? [])
      .filter((c) => !t || c.comprador.toLowerCase().includes(t))
      .sort((a, b) => (Number(b[ordem]) || 0) - (Number(a[ordem]) || 0));
  }, [clientes, busca, ordem]);

  const total = useMemo(() => {
    const l = clientes ?? [];
    return {
      clientes: l.length,
      total: l.reduce((s, c) => s + c.total, 0),
      pago: l.reduce((s, c) => s + c.pago, 0),
      pendente: l.reduce((s, c) => s + c.pendente, 0),
      itens: l.reduce((s, c) => s + c.itens, 0),
      voltaram: l.filter((c) => c.lives > 1).length,
    };
  }, [clientes]);

  async function abrir(handle: string) {
    if (aberto === handle) return setAberto(null);
    setAberto(handle);
    if (compras[handle]) return;
    const r = await chamar<{ compras: Compra[] }>(`/api/dash/clientes?handle=${encodeURIComponent(handle)}&de=${periodo.de}&ate=${periodo.ate}`);
    setCompras((c) => ({ ...c, [handle]: r.compras }));
  }

  const cabeca = (k: Ordem, rotulo: string) => (
    <th className="px-2 py-2.5 text-right font-semibold">
      <button onClick={() => setOrdem(k)} className={ordem === k ? "text-brand-yellow" : "hover:text-white"}>
        {rotulo}
      </button>
    </th>
  );

  return (
    <div className="dash-impressao">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-lg font-extrabold text-white">Clientes</h1>
        <span className="text-[12px] text-[#8b93a7]">{periodo.rotulo}</span>
        <span className="flex-1" />
        <Botao onClick={() => window.print()} className="dash-sem-impressao">
          <Printer size={14} /> PDF
        </Botao>
      </div>
      <div className="mb-4">{seletor}</div>
      {erro && <p className="mb-3 text-[13px] text-[#ff8a8a]">{erro}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Clientes" valor={inteiro(total.clientes)} detalhe={`${inteiro(total.voltaram)} compraram em mais de uma live`} />
        <Kpi rotulo="Total" valor={reais(total.total)} cor="text-[#6fdc94]" dinheiro />
        <Kpi rotulo="Pago" valor={reais(total.pago)} dinheiro />
        <Kpi rotulo="Pendente" valor={reais(total.pendente)} cor={total.pendente > 0 ? "text-[#ff8a8a]" : "text-white"} dinheiro />
        <Kpi rotulo="Itens" valor={inteiro(total.itens)} />
        <Kpi rotulo="Ticket por cliente" valor={reais(total.clientes ? total.total / total.clientes : 0)} dinheiro />
      </div>

      <div className="dash-sem-impressao relative mb-3 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input className={`${campo} pl-9`} placeholder="Buscar @cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <Cartao semPadding>
        {clientes === null ? (
          <Vazio>Carregando...</Vazio>
        ) : lista.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-[13px]">
              <thead className="text-left text-[10px] uppercase tracking-wider text-[#8b93a7]">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  {cabeca("total", "Total")}
                  <th className="px-2 py-2.5 text-right font-semibold">Pago</th>
                  {cabeca("pendente", "Pendente")}
                  {cabeca("itens", "Itens")}
                  <th className="px-2 py-2.5 text-right font-semibold">Compras</th>
                  {cabeca("lives", "Lives")}
                  <th className="px-2 py-2.5 text-right font-semibold">1ª compra</th>
                  {cabeca("ultima", "Última")}
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <Fragment key={c.comprador}>
                    <tr onClick={() => abrir(c.comprador)} className="cursor-pointer border-t border-white/[0.05] hover:bg-white/[0.02]">
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          {aberto === c.comprador ? <ChevronDown size={14} /> : <ChevronRight size={14} className="text-white/40" />}
                          <Avatar foto={c.foto} nome={c.comprador} tamanho={24} />
                          <span className="font-semibold text-white">@{c.comprador}</span>
                        </span>
                      </td>
                      <td className="dash-valor px-2 py-2 text-right font-semibold text-[#6fdc94]">{reais(c.total)}</td>
                      <td className="dash-valor px-2 py-2 text-right">{reais(c.pago)}</td>
                      <td className={`dash-valor px-2 py-2 text-right ${c.pendente > 0 ? "text-[#ff8a8a]" : "text-white/40"}`}>{reais(c.pendente)}</td>
                      <td className="px-2 py-2 text-right">{inteiro(c.itens)}</td>
                      <td className="px-2 py-2 text-right">{inteiro(c.compras)}</td>
                      <td className="px-2 py-2 text-right">{inteiro(c.lives)}</td>
                      <td className="px-2 py-2 text-right text-[12px] text-[#8b93a7]">{dataHora(c.primeira)}</td>
                      <td className="px-2 py-2 text-right text-[12px] text-[#8b93a7]">{dataHora(c.ultima)}</td>
                    </tr>
                    {aberto === c.comprador && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={9} className="px-4 py-3">
                          {!compras[c.comprador] ? (
                            <Vazio>Carregando compras...</Vazio>
                          ) : (
                            <ul className="space-y-1">
                              {compras[c.comprador].map((v) => (
                                <li key={v.id} className={`flex items-center gap-3 text-[12px] ${v.cancelado ? "opacity-40 line-through" : ""}`}>
                                  <span className="w-24 text-[#8b93a7]">{dataHora(v.ts)}</span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {v.titulo}
                                    {v.quantidade > 1 && ` · ${v.quantidade} un.`}
                                  </span>
                                  <span className="hidden max-w-[220px] truncate text-[#8b93a7] md:block">{v.live}</span>
                                  <span className="dash-valor w-24 text-right font-semibold">{reais(v.total)}</span>
                                  {v.pago === false && !v.cancelado ? <Selo cor="vermelho">pendente</Selo> : <span className="w-[62px]" />}
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
          </div>
        ) : (
          <Vazio>Nenhum cliente {busca ? "com esse nome" : "neste período"}.</Vazio>
        )}
      </Cartao>
    </div>
  );
}

