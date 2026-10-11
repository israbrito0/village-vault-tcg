"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import {
  engajamento,
  lerTermos,
  pontosDaLive,
  pontosPorPessoa,
  porIcone,
  porProduto,
  rankingCarpas,
  rankingCompradores,
  resumoVendas,
} from "@/lib/dash/calculos";
import { dataHora, duracao, inteiro, reais, useLiveDash } from "@/lib/dash/cliente";
import { Botao } from "@/components/dash/ui";

// Relatório de uma live, em folha branca, para salvar em PDF (Imprimir →
// Salvar como PDF). Tudo sai das mesmas contas do painel.

function Tabela({ titulo, cabecas, linhas }: { titulo: string; cabecas: string[]; linhas: (string | number)[][] }) {
  if (!linhas.length) return null;
  return (
    <section className="mt-6 break-inside-avoid">
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
            <tr key={i} className="border-t border-gray-100">
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

export default function Relatorio({ params }: { params: { showId: string } }) {
  const showId = decodeURIComponent(params.showId);
  const { dados: d, erro } = useLiveDash(showId, 0);

  const c = useMemo(() => {
    if (!d) return null;
    const termos = lerTermos(d.termos);
    const resumo = resumoVendas(d.vendas);
    const gemas = d.emocoes.reduce((s, e) => s + e.gemas, 0);
    const carpas = rankingCarpas(d.emocoes, d.chat, termos);
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

  if (!d || !c) return <p className="py-10 text-center text-[13px] text-[#8b93a7]">{erro || "Montando o relatório..."}</p>;

  const live = d.live;
  const m = live.metricas ?? {};
  const fim = live.fim ?? d.vendas.at(-1)?.ts ?? null;
  const numeros: [string, string][] = [
    ["Total vendido", reais(c.resumo.total)],
    ["Pago", reais(c.resumo.pago)],
    ["Pendente", reais(c.resumo.pendente)],
    ["Vendas", inteiro(c.resumo.vendas)],
    ["Itens", inteiro(c.resumo.itens)],
    ["Compradores", inteiro(c.resumo.compradores)],
    ["Ticket médio", reais(c.resumo.vendas ? c.resumo.total / c.resumo.vendas : 0)],
    ["Carpas douradas", inteiro(c.totalCarpas)],
    ["Emotions", `${inteiro(d.emocoes.length)} (${inteiro(c.gemas)} gemas)`],
    ["Mensagens no chat", inteiro(d.chat.length)],
    ["Pico de espectadores", m.pico ? inteiro(Number(m.pico)) : live.pico ? inteiro(live.pico) : "—"],
    ["Curtidas", live.likes != null ? inteiro(live.likes) : "—"],
    ["Pontos no ranking (≈)", inteiro(c.pontosLive)],
    ["Canceladas", inteiro(c.resumo.canceladas)],
  ];

  return (
    <div>
      <div className="dash-sem-impressao mb-4 flex items-center gap-2">
        <Botao cor="amarelo" onClick={() => window.print()}>
          <Printer size={14} /> Salvar PDF
        </Botao>
        <span className="text-[12px] text-[#8b93a7]">Na janela de impressão, escolha “Salvar como PDF”.</span>
      </div>

      <article className="mx-auto max-w-[900px] rounded-lg bg-white p-8 text-[#1f2430] shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start gap-4 border-b-2 border-[#F4AF14] pb-4">
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A6700]">Relatório da live · Village &amp; Vault</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold">{live.titulo || "Live"}</h1>
            <p className="mt-1 text-[12px] text-gray-500">
              @{live.vendedor} · {live.inicio ? dataHora(live.inicio) : "—"}
              {live.inicio && fim ? ` · ${duracao(fim - live.inicio)}` : ""}
            </p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-3">
          {numeros.map(([r, v]) => (
            <div key={r} className="flex justify-between border-b border-gray-100 py-1">
              <span className="text-gray-500">{r}</span>
              <b>{v}</b>
            </div>
          ))}
        </section>

        <Tabela
          titulo="Vendidos por produto"
          cabecas={["Produto", "Qtd", "Vendas", "Compradores", "Preço médio", "Total"]}
          linhas={c.produtos.map((p) => [p.titulo, inteiro(p.qtd), inteiro(p.vendas), inteiro(p.compradores), reais(p.medio), reais(p.total)])}
        />
        <Tabela
          titulo="Compradores"
          cabecas={["Cliente", "Itens", "Compras", "Pago", "Total"]}
          linhas={c.compradores.map((p) => [`@${p.handle}`, inteiro(p.itens), inteiro(p.compras), reais(p.pago), reais(p.total)])}
        />
        <Tabela titulo="Ranking de carpas" cabecas={["Pessoa", "Carpas"]} linhas={c.carpas.slice(0, 30).map((p) => [`@${p.handle}`, inteiro(p.carpas)])} />
        <Tabela
          titulo="Emotions"
          cabecas={["Emotion", "Envios", "Gemas"]}
          linhas={c.icones.map((i) => [d.icones[i.icone]?.nome ?? i.icone, inteiro(i.qtd), inteiro(i.gemas)])}
        />
        <Tabela titulo="Quem mais mandou gemas" cabecas={["Pessoa", "Emotions", "Gemas"]} linhas={c.pontos.slice(0, 30).map((p) => [`@${p.handle}`, inteiro(p.emocoes), inteiro(p.gemas)])} />
        <Tabela
          titulo="Sorteios"
          cabecas={["Sorteio", "Prêmio", "Ganhador", "Bilhetes", "Quando"]}
          linhas={d.sorteios.flatMap((s) =>
            s.ganhadores.map((g) => [s.nome, s.premio ?? "—", `@${g.handle}${g.status !== "valido" ? ` (${g.status})` : ""}`, `${g.bilhetes}/${g.totalBilhetes}`, dataHora(g.ts)]),
          )}
        />
        <Tabela
          titulo="Engajamento (top 40)"
          cabecas={["Pessoa", "Mensagens", "Emotions", "Compras", "Tempo ativo"]}
          linhas={c.eng.slice(0, 40).map((p) => [`@${p.handle}`, p.mensagens, p.emocoes, p.compras, duracao(p.ativoMs)])}
        />
        <p className="mt-8 text-center text-[10px] text-gray-400">
          Gerado em {dataHora(Date.now())} pelo Dash Village a partir do que a extensão viu na live.
        </p>
      </article>
    </div>
  );
}
