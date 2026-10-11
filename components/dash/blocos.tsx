"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Copy, Eye, Fish, Gavel, Gem, MessageSquareText, MessagesSquare, Package, Receipt, ShoppingBag, Star, Trophy } from "lucide-react";
import {
  descreverRegra,
  engajamento,
  lerTermos,
  liberacoes,
  mensagemDeGanhador,
  mensagemDeMetaBatida,
  mensagemDeSorteioLiberado,
  mensagemDoRanking,
  pareceRobo,
  participantesDaRegra,
  pontosDaLive,
  pontosPorPessoa,
  porIcone,
  porProduto,
  progressoIndividual,
  rankingCarpas,
  rankingCompradores,
  resumoVendas,
  totaisDaRegra,
} from "@/lib/dash/calculos";
import type { Sorteio } from "@/lib/dash/api";
import { copiar, duracao, hora, inteiro, reais, usePreferencia, type LiveCarregada } from "@/lib/dash/cliente";
import { falar, reaisFalado, tocar } from "@/lib/dash/som";
import { Avatar, Cartao, ChipEmocao, FiguraEmocao, Vazio } from "@/components/dash/ui";

// Os blocos que o Painel, os Sorteios e a Tela p/ compartilhar usam -- os
// mesmos cartões do Dash TCG, com as contas de calculos.ts.

const horaSeg = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });

// ---------- tudo que se calcula de uma live ----------

export type SorteioCalculado = Sorteio & {
  descricao: string;
  participantes: ReturnType<typeof participantesDaRegra>;
  concorrendo: ReturnType<typeof participantesDaRegra>;
  bilhetes: number;
  validos: Sorteio["ganhadores"];
  lib: ReturnType<typeof liberacoes>;
  individual: ReturnType<typeof progressoIndividual> | null;
};

export function useContasLive(d: LiveCarregada | null) {
  return useMemo(() => {
    if (!d) return null;
    const termos = lerTermos(d.termos);
    const resumo = resumoVendas(d.vendas);
    const carpas = rankingCarpas(d.emocoes, d.chat, termos);
    const totalCarpas = carpas.reduce((s, p) => s + p.carpas, 0);
    const gemas = d.emocoes.reduce((s, e) => s + (e.gemas || 0), 0);
    const eng = engajamento(d.emocoes, d.chat, d.vendas);
    const suspeitos = new Set(eng.filter((p) => pareceRobo(p.handle, p)).map((p) => p.handle));
    // Pontos do ranking agora: o oficial mais o que entrou depois da leitura.
    let estimado: number | null = null;
    if (d.ranking?.pontos != null && d.souVendedor) {
      const t = d.ranking.ts;
      const vendido = d.vendas.filter((v) => !v.cancelado && v.ts > t).reduce((s, v) => s + v.total, 0);
      const g = d.emocoes.filter((e) => e.ts > t).reduce((s, e) => s + e.gemas, 0);
      estimado = d.ranking.pontos + pontosDaLive(vendido, g, d.ranking.regras);
    }
    // A meta da live (topo da página de sorteios).
    const metaLive = d.metas.find((m) => m.escopo === "live" && (m.tipo === "ranking" || m.tipo === "emocoes")) ?? null;
    const atualMeta = metaLive ? (metaLive.tipo === "emocoes" ? gemas : estimado ?? d.ranking?.pontos ?? 0) : 0;
    const metaBatida = !!metaLive && atualMeta >= metaLive.alvo;
    const dados = { emocoes: d.emocoes, mensagens: d.chat, vendas: d.vendas };
    const sorteios: SorteioCalculado[] = d.sorteios.map((s) => {
      const regra = s.regra;
      const validos = s.ganhadores.filter((g) => g.status === "valido");
      const fora = s.ganhadores.filter((g) => g.status !== "valido").map((g) => g.handle);
      const participantes = participantesDaRegra({ ...regra, excluir: [...regra.excluir, ...fora] }, dados, d.live.vendedor, validos.map((g) => g.handle));
      const concorrendo = participantes.filter((p) => !p.fora);
      const t = totaisDaRegra(regra, d, { regrasRanking: d.ranking?.regras, metaDaLiveBatida: metaBatida });
      return {
        ...s,
        descricao: descreverRegra(regra),
        participantes,
        concorrendo,
        bilhetes: concorrendo.reduce((x, p) => x + p.bilhetes, 0),
        validos,
        lib: liberacoes(regra, t, validos.length),
        individual: regra.tipo === "individual" ? progressoIndividual(regra, d, d.live.vendedor) : null,
      };
    });
    return {
      termos,
      resumo,
      carpas,
      totalCarpas,
      gemas,
      eng,
      suspeitos,
      estimado,
      metaLive,
      atualMeta,
      metaBatida,
      sorteios,
      pontos: pontosPorPessoa(d.emocoes),
      compradores: rankingCompradores(d.vendas),
      produtos: porProduto(d.vendas),
      icones: porIcone(d.emocoes),
    };
  }, [d]);
}

export type Contas = NonNullable<ReturnType<typeof useContasLive>>;

// ---------- mensagens para o chat ----------

export type Recado = { id: string; texto: string; ts: number };

export function useRecados() {
  const [recados, setRecados] = useState<Recado[]>([]);
  const novo = (texto: string) => setRecados((r) => [{ id: `${Date.now()}-${Math.random()}`, texto, ts: Date.now() }, ...r].slice(0, 30));
  return { recados, novo };
}

function textoDeStatus(c: Contas) {
  const linhas: string[] = [];
  for (const s of c.sorteios) {
    if (!s.ativo || s.regra.tipo !== "sorteio") continue;
    if (s.lib.livre) continue;
    if (s.lib.disponiveis > 0) linhas.push(`🎉 ${s.nome}: Pião da Village TCG liberado!`);
    else if (s.lib.proximo) linhas.push(`🎁 ${s.nome}: faltam ${inteiro(Math.ceil(s.lib.proximo.falta))} ${s.lib.proximo.unidade} pro próximo sorteio${s.premio ? ` (${s.premio})` : ""}!`);
  }
  if (c.metaLive && !c.metaBatida) linhas.push(`🎯 Meta da live: faltam ${inteiro(c.metaLive.alvo - c.atualMeta)} pontos!`);
  if (!linhas.length) linhas.push(`🐟 ${inteiro(c.totalCarpas)} carpas douradas na live! Manda a tua que conta pro sorteio!`);
  return linhas.join("\n");
}

export function MensagensChat({ d, c, recados, novo }: { d: LiveCarregada; c: Contas; recados: Recado[]; novo: (t: string) => void }) {
  const [minutos, setMinutos] = usePreferencia("status-minutos", 0);
  const [copiado, setCopiado] = useState("");
  const ref = useRef(c);
  ref.current = c;
  useEffect(() => {
    if (!minutos) return;
    const t = setInterval(() => novo(textoDeStatus(ref.current)), minutos * 60000);
    return () => clearInterval(t);
  }, [minutos, novo]);

  const posicao = d.souVendedor ? d.ranking?.posicao : null;
  return (
    <section className="d-card">
      <header className="d-card-header">
        <div className="min-w-[200px] flex-1">
          <h2 className="d-card-title">
            <MessageSquareText className="size-4 shrink-0 text-d-brand" />
            <span className="truncate">Mensagens para o chat</span>
          </h2>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-d-ink3">
          Sugerir status
          <select className="d-field rounded-lg px-2 py-1 text-xs" value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
            <option value={0}>desligado</option>
            <option value={5}>a cada 5 min</option>
            <option value={10}>a cada 10 min</option>
            <option value={15}>a cada 15 min</option>
          </select>
        </label>
        {d.souVendedor && (
          <button
            className="d-btn d-btn-secondary d-btn-sm border-d-gold/50 text-d-gold"
            title="Monta a mensagem da posição no Ranking Mensal da Jamble"
            onClick={() => novo(mensagemDoRanking(d.ranking, c.estimado))}
          >
            <Trophy className="size-4 shrink-0" />
            Ranking {posicao ? `#${posicao}` : ""}
          </button>
        )}
        <button className="d-btn d-btn-primary d-btn-sm" title="Monta agora as mensagens de quanto falta para cada sorteio" onClick={() => novo(textoDeStatus(c))}>
          Gerar status agora
        </button>
      </header>
      {recados.length ? (
        <ul className="d-scroll max-h-64 divide-y divide-d-line overflow-y-auto">
          {recados.map((r) => (
            <li key={r.id} className="d-pop-in flex items-start gap-3 px-4 py-2.5">
              <p className="min-w-0 flex-1 whitespace-pre-line text-sm">{r.texto}</p>
              <span className="text-xs tabular-nums text-d-ink3">{hora(r.ts)}</span>
              <button
                className="d-btn d-btn-secondary d-btn-sm"
                onClick={async () => {
                  await copiar(r.texto);
                  setCopiado(r.id);
                  setTimeout(() => setCopiado(""), 1500);
                }}
              >
                <Copy className="size-3.5" />
                {copiado === r.id ? "Copiado" : "Copiar"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-center text-sm text-d-ink3">As mensagens aparecem aqui quando o Pião da Village TCG for liberado, alguém bater uma meta ou ao gerar o status.</p>
      )}
    </section>
  );
}

// ---------- sons, voz e avisos automáticos ----------

export function useAvisos(
  d: LiveCarregada | null,
  c: Contas | null,
  o: { sons: boolean; volume: number; voz: boolean; novo: (t: string) => void },
) {
  const antes = useRef<{ vendas: Set<string>; pagas: Set<string>; carpas: number; leilao: string; melhor: number; liberados: Record<string, number>; meta: boolean; bateram: Record<string, number> } | null>(null);
  const ultimaFala = useRef(0);
  const opcoes = useRef(o);
  opcoes.current = o;

  useEffect(() => {
    if (!d || !c) return;
    const leilao = d.live.leilao;
    const agora = {
      vendas: new Set(d.vendas.filter((v) => !v.cancelado).map((v) => v.id)),
      pagas: new Set(d.vendas.filter((v) => !v.cancelado && v.pago === true).map((v) => v.id)),
      carpas: c.totalCarpas,
      leilao: leilao?.id ?? "",
      melhor: Number(leilao?.melhor) || 0,
      liberados: Object.fromEntries(c.sorteios.map((s) => [s.id, Number.isFinite(s.lib.liberados) ? s.lib.liberados : 0])),
      meta: c.metaBatida,
      bateram: Object.fromEntries(c.sorteios.filter((s) => s.individual).map((s) => [s.id, s.individual!.bateram.length])),
    };
    const a = antes.current;
    antes.current = agora;
    if (!a) return; // primeira carga: só anota
    const { sons, volume, voz, novo } = opcoes.current;
    const dizer = (t: string) => voz && falar(t, { volume: 1, velocidade: 1.05 });

    const novas = d.vendas.filter((v) => !v.cancelado && !a.vendas.has(v.id));
    if (novas.length) {
      if (sons) tocar("venda", volume);
      const v = novas[novas.length - 1];
      dizer(`Vendido! ${v.titulo} para ${v.comprador ?? "alguém"} por ${reaisFalado(v.total)}`);
    }
    if ([...agora.pagas].some((id) => !a.pagas.has(id) && a.vendas.has(id)) && sons) tocar("pagamento", volume);
    if (c.totalCarpas > a.carpas && sons) tocar("carpa", volume * 0.7);

    if (leilao?.id && leilao.id !== a.leilao && leilao.situacao === "rolando") {
      dizer(`Leilão aberto: ${leilao.titulo ?? ""}${leilao.inicial ? `, começa em ${reaisFalado(leilao.inicial)}` : ""}. Quem dá mais?`);
    } else if (leilao?.id === a.leilao && agora.melhor > a.melhor) {
      if (sons) tocar("lance", volume * 0.6);
      if (Date.now() - ultimaFala.current > 2500) {
        ultimaFala.current = Date.now();
        dizer(`${reaisFalado(agora.melhor)}${leilao.vencedor ? `, ${leilao.vencedor}` : ""}`);
      }
    }

    for (const s of c.sorteios) {
      const lib = agora.liberados[s.id] ?? 0;
      if (!s.lib.livre && lib > (a.liberados[s.id] ?? 0)) {
        if (sons) tocar("sorteio", volume);
        dizer(`Pião da Village TCG liberado: ${s.nome}`);
        novo(mensagemDeSorteioLiberado(s.nome, s.premio));
      }
      const bateram = agora.bateram[s.id] ?? 0;
      if (s.individual && bateram > (a.bateram[s.id] ?? 0)) {
        const quem = s.individual.bateram.slice(a.bateram[s.id] ?? 0);
        if (sons) tocar("meta", volume);
        for (const p of quem) novo(`🎯 @${p.handle} bateu a meta "${s.nome}"${s.premio ? ` e ganhou ${s.premio}` : ""}! 🎉`);
      }
    }
    if (agora.meta && !a.meta) {
      if (sons) tocar("meta", volume);
      dizer("Meta da live batida!");
      novo(mensagemDeMetaBatida("Meta da live"));
    }
  }, [d, c]);
}

// Contagem regressiva falada do leilão ("dou-lhe uma, dou-lhe duas").
function useDouLhe(termina: number | null | undefined, voz: boolean) {
  useEffect(() => {
    if (!voz || !termina) return;
    const falta = termina - Date.now();
    const t1 = falta > 3200 ? setTimeout(() => falar("Dou-lhe uma…"), falta - 3000) : null;
    const t2 = falta > 1700 ? setTimeout(() => falar("Dou-lhe duas…"), falta - 1500) : null;
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [termina, voz]);
}

// ---------- cartões ----------

export function Leiloeiro({ d, voz, setVoz }: { d: LiveCarregada; voz: boolean; setVoz: (v: boolean) => void }) {
  const l = d.live.leilao;
  const rolando = !!l && (l.situacao === "rolando" || l.situacao === undefined);
  useDouLhe(rolando ? l?.termina : null, voz);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const ultimas = d.vendas.filter((v) => !v.cancelado).slice(-3).reverse();
  const b = d.live.batalha;
  return (
    <Cartao
      titulo="Leiloeiro"
      icone={Gavel}
      direita={
        <button
          className={`d-btn d-btn-secondary d-btn-sm ${voz ? "text-d-gold" : "text-d-ink3"}`}
          title={voz ? "Voz do leiloeiro ligada — clique para silenciar" : "Ligar a voz do leiloeiro"}
          onClick={() => {
            if (!voz) falar("Leiloeiro ligado! Quem dá mais?");
            setVoz(!voz);
          }}
        >
          🎙️ {voz ? "Voz ligada" : "Voz desligada"}
        </button>
      }
    >
      <div className="space-y-3 p-4">
        {l && rolando ? (
          <div className="d-pop-in space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{l.titulo ?? "Produto"}</p>
                <p className="text-xs text-d-ink3">
                  {l.tipo === "BUY_IT_NOW" ? "Compra direta" : l.tipo === "SUDDEN_DEATH" ? "Morte súbita" : "Leilão"}
                  {l.inicial ? ` · lance inicial ${reais(l.inicial)}` : ""}
                </p>
              </div>
              {l.termina && l.termina > agora && (
                <span className="rounded-full bg-d-bad/15 px-2.5 py-1 text-sm font-bold tabular-nums text-d-bad">{Math.ceil((l.termina - agora) / 1000)}s</span>
              )}
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="dash-valor text-3xl font-bold tabular-nums text-d-ok">{reais(Number(l.melhor || l.inicial || 0))}</p>
              {l.vencedor && <p className="truncate text-sm font-semibold text-d-brand">@{l.vencedor}</p>}
            </div>
            <p className="text-xs text-d-ink3">
              {inteiro(l.lances ?? 0)} lances · {inteiro(l.disputaram ?? 0)} disputando
            </p>
          </div>
        ) : (
          <p className="py-3 text-center text-sm text-d-ink3">Aguardando o próximo leilão…</p>
        )}
        {b && !b.acabou && (
          <div className="flex items-center gap-2 rounded-xl bg-d-panel2 px-3 py-2 text-sm">
            <span className="font-bold text-d-bad">Vermelho {inteiro(b.vermelho.pontos)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#158BCA]/40">
              <span className="block h-full bg-d-bad" style={{ width: `${(b.vermelho.pontos / Math.max(1, b.vermelho.pontos + b.azul.pontos)) * 100}%` }} />
            </span>
            <span className="font-bold text-[#7cc7f0]">{inteiro(b.azul.pontos)} Azul</span>
          </div>
        )}
        {ultimas.length > 0 && (
          <ul className="divide-y divide-d-line rounded-xl border border-d-line">
            {ultimas.map((v) => (
              <li key={v.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <span className="font-semibold text-d-ok">Vendido!</span>
                <span className="min-w-0 flex-1 truncate">
                  {v.titulo} · @{v.comprador ?? "?"}
                </span>
                <span className="dash-valor font-bold tabular-nums">{reais(v.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cartao>
  );
}

export function RankingCarpas({ c, altura = "h-[520px]" }: { c: Contas; altura?: string }) {
  return (
    <Cartao titulo="Ranking de carpas" icone={Fish} className={altura} direita={<span className="text-xs text-d-ink3">{inteiro(c.carpas.length)} pessoas</span>}>
      {c.carpas.length ? (
        <ol className="divide-y divide-d-line">
          {c.carpas.map((p, i) => (
            <li key={p.handle} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 text-center font-bold tabular-nums text-d-gold">{i + 1}</span>
              <Avatar foto={p.foto} nome={p.handle} tamanho={32} />
              <span className="min-w-0 flex-1 truncate font-medium">@{p.handle}</span>
              {c.suspeitos.has(p.handle) && (
                <span title="Conta em lote (nome inventado, nunca escreve nem compra): fica fora dos sorteios" className="rounded-full bg-d-bad/15 px-2 py-0.5 text-[10px] font-semibold text-d-bad">
                  lote
                </span>
              )}
              <span className="text-lg font-bold tabular-nums text-d-gold">{inteiro(p.carpas)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Vazio>Nenhuma carpa dourada ainda.</Vazio>
      )}
    </Cartao>
  );
}

export function Emotions({
  d,
  c,
  altura = "h-[520px]",
  alternarTermo,
  limpoEm = 0,
}: {
  d: LiveCarregada;
  c: Contas;
  altura?: string;
  alternarTermo?: (icone: string) => void;
  limpoEm?: number;
}) {
  const feed = d.emocoes.filter((e) => e.ts >= limpoEm).slice(-150).reverse();
  return (
    <Cartao titulo="Diamantes" icone={Gem} className={altura} direita={<span className="text-xs text-d-ink3">{inteiro(d.emocoes.length)} recebidas</span>}>
      <div className="flex flex-wrap gap-2 border-b border-d-line p-3">
        {c.icones.map((i) => {
          const ligado = c.termos.includes(i.icone);
          return (
            <ChipEmocao
              key={i.icone}
              id={i.icone}
              icones={d.icones}
              qtd={i.qtd}
              ligado={ligado}
              titulo={alternarTermo ? (ligado ? "Remover dos termos da carpa" : "Contar como carpa dourada") : undefined}
              onClick={alternarTermo ? () => alternarTermo(i.icone) : undefined}
            />
          );
        })}
        {!c.icones.length && <span className="text-xs text-d-ink3">Nenhum diamante ainda.</span>}
      </div>
      <ul className="divide-y divide-d-line">
        {feed.map((e) => (
          <li key={e.id} className="d-pop-in flex items-center gap-3 px-4 py-2">
            <Avatar foto={e.foto} nome={e.handle} tamanho={28} />
            <span className="min-w-0 flex-1 truncate text-sm">@{e.handle}</span>
            <FiguraEmocao id={e.icone} icones={d.icones} />
            <span className="w-16 text-right text-xs tabular-nums text-d-ink3">{horaSeg(e.ts)}</span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

export function Chat({ d, altura = "h-[520px]", limpoEm = 0 }: { d: LiveCarregada; altura?: string; limpoEm?: number }) {
  const msgs = d.chat.filter((m) => m.ts >= limpoEm).slice(-200).reverse();
  return (
    <Cartao titulo="Chat" icone={MessagesSquare} className={altura}>
      {msgs.length ? (
        <ul className="space-y-0.5 p-2">
          {msgs.map((m) => (
            <li key={m.id} className="d-pop-in flex gap-2.5 rounded-xl px-2 py-1.5 hover:bg-d-panel2">
              <Avatar foto={m.foto} nome={m.handle} tamanho={26} />
              <p className="min-w-0 text-sm leading-snug">
                <span className="font-semibold text-d-brand">@{m.handle}</span> <span className="break-words">{m.texto}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>Nenhuma mensagem ainda.</Vazio>
      )}
    </Cartao>
  );
}

export function PontosPorUsuario({ c, altura = "h-[480px]" }: { c: Contas; altura?: string }) {
  return (
    <Cartao titulo="Pontos por usuário" icone={Star} className={altura} direita={<span className="text-xs text-d-ink3">{inteiro(c.gemas)} pts no total</span>}>
      {c.pontos.length ? (
        <ol className="divide-y divide-d-line">
          {c.pontos.map((p, i) => (
            <li key={p.handle} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 text-center font-bold tabular-nums text-d-brand">{i + 1}</span>
              <Avatar foto={p.foto} nome={p.handle} tamanho={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">@{p.handle}</p>
                <p className="text-xs text-d-ink3">{inteiro(p.emocoes)} diamantes</p>
              </div>
              <span className="text-lg font-bold tabular-nums text-d-brand">
                {inteiro(p.gemas)} <span className="text-xs font-semibold text-d-ink3">pts</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Vazio>Ninguém mandou diamante ainda.</Vazio>
      )}
    </Cartao>
  );
}

export function RankingCompradores({ c, altura = "h-[480px]" }: { c: Contas; altura?: string }) {
  return (
    <Cartao
      titulo={`Ranking de compradores (${c.compradores.length})`}
      icone={ShoppingBag}
      className={altura}
      direita={<span className="dash-valor text-xs text-d-ink3">pago: {reais(c.resumo.pago)}</span>}
    >
      {c.compradores.length ? (
        <ol className="divide-y divide-d-line">
          {c.compradores.map((p, i) => (
            <li key={p.handle} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 text-center font-bold tabular-nums text-d-ok">{i + 1}</span>
              <Avatar foto={p.foto} nome={p.handle} tamanho={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">@{p.handle}</p>
                <p className="text-xs text-d-ink3">{inteiro(p.itens)} itens</p>
              </div>
              <span className="dash-valor font-bold tabular-nums text-d-ok">{reais(p.pago)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Vazio>Nenhuma venda ainda.</Vazio>
      )}
    </Cartao>
  );
}

const tipoDeVenda = (t?: string | null) => (t === "BUY_IT_NOW" ? "Compra direta" : t === "SUDDEN_DEATH" ? "Morte súbita" : "Leilão");

export function Vendas({ d, altura = "h-[480px]", limpoEm = 0 }: { d: LiveCarregada; altura?: string; limpoEm?: number }) {
  const lista = d.vendas.filter((v) => v.ts >= limpoEm).slice().reverse();
  const validas = d.vendas.filter((v) => !v.cancelado).length;
  return (
    <Cartao titulo={`Vendas (${validas})`} icone={Receipt} className={altura} direita={<span className="text-xs text-d-ink3">atualizado {horaSeg(d.atualizadoEm)}</span>}>
      {lista.length ? (
        <ul className="divide-y divide-d-line">
          {lista.map((v) => (
            <li key={v.id} className={`flex items-center gap-3 px-4 py-2.5 ${v.cancelado ? "opacity-40" : ""}`}>
              {v.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.imagem} alt="" className="size-11 shrink-0 rounded-lg bg-d-panel2 object-cover" />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-d-panel2 text-d-ink3">
                  <Package className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${v.cancelado ? "line-through" : ""}`}>{v.titulo}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-d-ink3">
                  <Avatar foto={v.foto} nome={v.comprador} tamanho={16} />@{v.comprador ?? "?"} · {tipoDeVenda(v.tipo)}
                  {v.quantidade > 1 ? ` · ${v.quantidade} un.` : ""} · {horaSeg(v.ts)}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  v.cancelado ? "bg-d-ink3/15 text-d-ink3" : v.pago === false ? "bg-d-warn/15 text-d-warn" : "bg-d-ok/15 text-d-ok"
                }`}
              >
                {v.cancelado ? "Cancelada" : v.pago === false ? "Pendente" : "Paga"}
              </span>
              <span className="dash-valor w-24 text-right font-bold tabular-nums">{reais(v.total)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>Nenhuma venda ainda.</Vazio>
      )}
    </Cartao>
  );
}

export function PorProduto({ c }: { c: Contas }) {
  return (
    <Cartao titulo={`Vendidos por produto (${c.produtos.length})`} icone={Package} className="max-h-[520px] lg:col-span-3" direita={<span className="text-xs text-d-ink3">só vendas pagas</span>}>
      {c.produtos.length ? (
        <table className="dash-valor w-full text-sm">
          <thead className="sticky top-0 bg-d-panel text-left text-[11px] uppercase tracking-wider text-d-ink3">
            <tr className="border-b border-d-line">
              <th className="px-4 py-2 font-semibold">Produto</th>
              <th className="px-4 py-2 text-right font-semibold">Qtd</th>
              <th className="px-4 py-2 text-right font-semibold">Valor total</th>
              <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Preço médio</th>
              <th className="hidden px-4 py-2 text-right font-semibold md:table-cell">Vendas</th>
              <th className="hidden px-4 py-2 text-right font-semibold md:table-cell">Compradores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-d-line">
            {c.produtos.map((p) => (
              <tr key={p.titulo} className="hover:bg-d-panel2/50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    {p.imagem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem} alt="" className="size-9 shrink-0 rounded-lg bg-d-panel2 object-cover" />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-d-panel2 text-d-ink3">
                        <Package className="size-4" />
                      </span>
                    )}
                    <span className="font-medium">{p.titulo}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums">{inteiro(p.qtd)}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-d-ok">{reais(p.total)}</td>
                <td className="hidden px-4 py-2 text-right tabular-nums text-d-ink2 sm:table-cell">{reais(p.medio)}</td>
                <td className="hidden px-4 py-2 text-right tabular-nums text-d-ink2 md:table-cell">{inteiro(p.vendas)}</td>
                <td className="hidden px-4 py-2 text-right tabular-nums text-d-ink2 md:table-cell">{inteiro(p.compradores)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Vazio>Nada pago ainda.</Vazio>
      )}
    </Cartao>
  );
}

export function Engajamento({ d, c }: { d: LiveCarregada; c: Contas }) {
  return (
    <Cartao titulo={`Engajamento por espectador (${c.eng.length})`} icone={Activity} className="max-h-[520px] lg:col-span-3" direita={<span className="text-xs text-d-ink3">atualizado {horaSeg(d.atualizadoEm)}</span>}>
      <p className="border-b border-d-line px-4 py-2 text-xs text-d-ink3">
        O tempo ativo vai da 1ª à última interação da pessoa (chat, diamante ou compra). Quem só assiste aparece em &quot;Assistindo agora&quot;.
      </p>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-d-panel text-left text-[11px] uppercase tracking-wider text-d-ink3">
          <tr className="border-b border-d-line">
            <th className="w-10 px-4 py-2 font-semibold">#</th>
            <th className="px-4 py-2 font-semibold">Espectador</th>
            <th className="px-4 py-2 text-right font-semibold">Mensagens</th>
            <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Diamantes</th>
            <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Compras</th>
            <th className="px-4 py-2 text-right font-semibold">Tempo ativo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-d-line">
          {c.eng.slice(0, 300).map((p, i) => (
            <tr key={p.handle} className="hover:bg-d-panel2/50">
              <td className="px-4 py-2 tabular-nums text-d-ink3">{i + 1}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar foto={p.foto} nome={p.handle} tamanho={26} />
                  <span className="truncate font-medium">@{p.handle}</span>
                </div>
              </td>
              <td className="px-4 py-2 text-right font-bold tabular-nums">{inteiro(p.mensagens)}</td>
              <td className="hidden px-4 py-2 text-right tabular-nums text-d-ink2 sm:table-cell">{inteiro(p.emocoes)}</td>
              <td className="hidden px-4 py-2 text-right tabular-nums text-d-ink2 sm:table-cell">{inteiro(p.compras)}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                <span className="font-semibold">{duracao(p.ativoMs)}</span>
                <span className="block text-xs text-d-ink3">
                  {hora(p.primeira)}–{hora(p.ultima)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Cartao>
  );
}

// Quem está na live agora: o robô lê a lista de espectadores da Jamble a cada
// rodada (cerca de 1 minuto). Quem já interagiu mostra o que fez.
export function AssistindoAgora({ d, c }: { d: LiveCarregada; c: Contas }) {
  const m = d.live.metricas as Record<string, unknown>;
  const lista = Array.isArray(m.assistindo) ? (m.assistindo as { handle: string; foto: string | null }[]) : [];
  const total = Number(m.assistindoTotal) || lista.length;
  const quando = Number(m.assistindoEm) || null;
  const eng = useMemo(() => new Map(c.eng.map((p) => [p.handle.toLowerCase(), p])), [c.eng]);
  if (!lista.length) return null;
  const ordenada = [...lista].sort((a, b) => Number(eng.has(b.handle.toLowerCase())) - Number(eng.has(a.handle.toLowerCase())));
  const calados = lista.filter((p) => !eng.has(p.handle.toLowerCase())).length;
  return (
    <Cartao
      titulo={`Assistindo agora (${inteiro(total)})`}
      icone={Eye}
      className="max-h-[420px] lg:col-span-3"
      direita={<span className="text-xs text-d-ink3">{calados} só assistindo{quando ? ` · lido ${horaSeg(quando)}` : ""}</span>}
    >
      <ul className="grid gap-1 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {ordenada.map((p) => {
          const e = eng.get(p.handle.toLowerCase());
          return (
            <li key={p.handle} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-d-panel2/60">
              <Avatar foto={p.foto} nome={p.handle} tamanho={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">@{p.handle}</span>
                <span className="block truncate text-[11px] text-d-ink3">
                  {e ? [e.mensagens && `${e.mensagens} msg`, e.emocoes && `${e.emocoes} diamantes`, e.compras && `${e.compras} compras`].filter(Boolean).join(" · ") : "só assistindo"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

export { mensagemDeGanhador };
