"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Gift, Printer, Radio } from "lucide-react";
import type { LiveResumo } from "@/lib/dash/api";
import { dataHora, inteiro, reais, useDash } from "@/lib/dash/cliente";
import { usePeriodo } from "@/components/dash/Periodo";
import { AoVivo, Botao, Cartao, Kpi, Vazio } from "@/components/dash/ui";

// Lives & relatórios: cada live do período com vendido, pago, itens,
// compradores, emotions e sorteios, e o relatório em PDF de cada uma.
export default function Lives() {
  const { chamar } = useDash();
  const { periodo, seletor } = usePeriodo("30d");
  const [lives, setLives] = useState<LiveResumo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setLives(null);
    chamar<{ lives: LiveResumo[] }>(`/api/dash/lives?de=${periodo.de}&ate=${periodo.ate}`)
      .then((r) => setLives(r.lives))
      .catch((e) => setErro(String(e.message)));
  }, [chamar, periodo.de, periodo.ate]);

  const total = useMemo(() => {
    const l = lives ?? [];
    const soma = (k: keyof LiveResumo) => l.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    return { lives: l.length, total: soma("total"), pago: soma("pago"), itens: soma("itens"), compradores: soma("compradores"), emocoes: soma("emocoes"), gemas: soma("gemas"), ganhadores: soma("ganhadores") };
  }, [lives]);

  return (
    <div className="dash-impressao">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-lg font-extrabold text-white">Lives & relatórios</h1>
        <span className="text-[12px] text-[#8b93a7]">{periodo.rotulo}</span>
        <span className="flex-1" />
        <Botao onClick={() => window.print()} className="dash-sem-impressao">
          <Printer size={14} /> PDF do período
        </Botao>
      </div>
      <div className="mb-4">{seletor}</div>
      {erro && <p className="mb-3 text-[13px] text-[#ff8a8a]">{erro}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Lives" valor={inteiro(total.lives)} />
        <Kpi rotulo="Vendido" valor={reais(total.total)} cor="text-[#6fdc94]" dinheiro />
        <Kpi rotulo="Pago" valor={reais(total.pago)} dinheiro detalhe={total.total > total.pago ? `${reais(total.total - total.pago)} pendente` : undefined} />
        <Kpi rotulo="Itens" valor={inteiro(total.itens)} />
        <Kpi rotulo="Emotions" valor={inteiro(total.emocoes)} detalhe={`${inteiro(total.gemas)} gemas`} />
        <Kpi rotulo="Sorteios feitos" valor={inteiro(total.ganhadores)} />
      </div>

      <Cartao semPadding>
        {lives === null ? (
          <Vazio>Carregando...</Vazio>
        ) : lives.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead className="text-left text-[10px] uppercase tracking-wider text-[#8b93a7]">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2.5 font-semibold">Live</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Vendido</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Pago</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Itens</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Compradores</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Emotions</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Sorteios</th>
                  <th className="dash-sem-impressao px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lives.map((l) => (
                  <tr key={l.showId} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <p className="max-w-[340px] truncate font-semibold text-white">{l.titulo || "Live"}</p>
                      <p className="flex items-center gap-2 text-[11px] text-[#8b93a7]">
                        {dataHora(l.inicio)} {l.aoVivo && <AoVivo aoVivo />}
                      </p>
                    </td>
                    <td className="dash-valor px-2 py-2.5 text-right font-semibold text-[#6fdc94]">{reais(l.total)}</td>
                    <td className="dash-valor px-2 py-2.5 text-right">{reais(l.pago)}</td>
                    <td className="px-2 py-2.5 text-right">{inteiro(l.itens)}</td>
                    <td className="px-2 py-2.5 text-right">{inteiro(l.compradores)}</td>
                    <td className="px-2 py-2.5 text-right">{inteiro(l.emocoes)}</td>
                    <td className="px-2 py-2.5 text-right">{inteiro(l.ganhadores)}</td>
                    <td className="dash-sem-impressao px-4 py-2.5">
                      <span className="flex justify-end gap-1">
                        <Link href={`/dash/painel/${encodeURIComponent(l.showId)}`} title="Painel" className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                          <Radio size={15} />
                        </Link>
                        <Link href={`/dash/sorteios/${encodeURIComponent(l.showId)}`} title="Sorteios" className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                          <Gift size={15} />
                        </Link>
                        <Link href={`/dash/relatorio/${encodeURIComponent(l.showId)}`} title="Relatório em PDF" className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                          <FileText size={15} />
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio>Nenhuma live sua neste período. As lives entram aqui conforme a extensão manda.</Vazio>
        )}
      </Cartao>
    </div>
  );
}
