"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Maximize2, Music, Pencil, Play, Plus, Sparkles, Square, Target, Timer, Upload, Users, Volume2, VolumeX, X } from "lucide-react";
import { descreverRegra, mensagemDeGanhador, regraPadrao, type Regra } from "@/lib/dash/calculos";
import type { Meta, Sorteio, VisualDoSorteio } from "@/lib/dash/api";
import { chamarApi, copiar, DashContexto, hora, inteiro, linkDaTela, useDash, useLiveDash, usePreferencia, type LiveCarregada } from "@/lib/dash/cliente";
import { destravarAudio, tocar } from "@/lib/dash/som";
import { tocarMusica, type Tocando } from "@/lib/dash/musica";
import { supabaseNavegador } from "@/lib/supabase-navegador";
import Roleta from "@/components/dash/Roleta";
import Piao, { DURACAO_PIAO } from "@/components/dash/Piao";
import { Emotions, MensagensChat, useAvisos, useContasLive, useRecados, type Contas, type SorteioCalculado } from "@/components/dash/blocos";
import { Avatar, Barra, ChipEmocao, Escolha, StatusLive, Vazio, Volume } from "@/components/dash/ui";

// Sorteios & Metas, no desenho do Dash TCG: barra com "Novo sorteio", "Nova
// meta individual" e os modelos; a meta da live; as mensagens; as emotions; e
// um cartão por sorteio, com a roleta, os participantes e os ganhadores.

type Pessoa = { handle: string; foto: string | null; bilhetes: number };
type Giro = { chave: string; sorteioId: string; ganhador: Pessoa; lista: Pessoa[]; premio: string | null; nome: string };
type Acao = (corpo: Record<string, unknown>) => Promise<{ sorteios: Sorteio[]; ganhador?: Pessoa & { id: string }; roleta?: Pessoa[] } | null>;

// Quanto tempo o giro dura em cada estilo (o pião gira mais, com a música).
export const duracaoDoGiro = (v: VisualDoSorteio) => (v.estilo === "fita" ? 6500 : DURACAO_PIAO);

// O giro do sorteio no estilo que a conta escolheu: o pião (padrão) ou a fita.
function GiroDoSorteio({ giro, visual, volume, grande = false }: { giro: Giro; visual: VisualDoSorteio; volume: number; grande?: boolean }) {
  return visual.estilo === "fita" ? (
    <Roleta key={giro.chave} participantes={giro.lista} ganhador={giro.ganhador} premio={giro.premio} volume={volume} grande={grande} />
  ) : (
    <Piao
      key={giro.chave}
      participantes={giro.lista}
      ganhador={giro.ganhador}
      premio={giro.premio}
      volume={volume}
      musica={{ tipo: visual.musica, url: visual.musicaUrl }}
      grande={grande}
    />
  );
}

const MODELOS: { rotulo: string; nome: string; regra: Partial<Regra> }[] = [
  { rotulo: "Compradores", nome: "Sorteio para compradores", regra: { quem: "compra", liberacao: "livre", chance: "quantidade" } },
  { rotulo: "Magikarp shiny", nome: "Sorteio para quem enviou magikarp_shiny", regra: { quem: "emocao", icones: ["magikarp_shiny"], liberacao: "livre", chance: "quantidade" } },
  { rotulo: "Todos que enviaram emotions", nome: "Sorteio para todos que enviaram emotions", regra: { quem: "emocao", icones: null, liberacao: "livre", chance: "quantidade" } },
];

// ---------- formulário da regra ----------

function FormRegra({
  d,
  inicial,
  aoSalvar,
  aoFechar,
}: {
  d: LiveCarregada;
  inicial: { id?: string; nome: string; premio: string; regra: Regra };
  aoSalvar: (f: { id?: string; nome: string; premio: string; regra: Regra }) => Promise<void>;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(inicial.nome);
  const [premio, setPremio] = useState(inicial.premio);
  const [r, setR] = useState<Regra>(inicial.regra);
  const [ocupado, setOcupado] = useState(false);
  const muda = (x: Partial<Regra>) => setR({ ...r, ...x });
  const mudaMeta = (k: keyof Regra["metas"], v: number | boolean | null) => setR({ ...r, metas: { ...r.metas, [k]: v } });
  const individual = r.tipo === "individual";

  // Emotions que aparecem para marcar: as da tabela da Jamble e as da live.
  const todas = useMemo(() => {
    const vistas = new Map<string, number>();
    for (const e of d.emocoes) vistas.set(e.icone, (vistas.get(e.icone) ?? 0) + 1);
    const ids = [...new Set([...vistas.keys(), ...Object.keys(d.icones)])];
    return ids.sort((a, b) => (vistas.get(b) ?? 0) - (vistas.get(a) ?? 0)).map((id) => ({ id, pts: d.icones[id]?.gemas ?? d.emocoes.find((e) => e.icone === id)?.gemas ?? null }));
  }, [d.emocoes, d.icones]);
  const marcada = (id: string) => !r.icones || r.icones.includes(id);
  const alternar = (id: string) => {
    const atuais = r.icones ?? todas.map((t) => t.id);
    muda({ icones: atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id] });
  };

  const linhaMeta = (k: "emocoes" | "pontos" | "itens" | "reais" | "ranking", padrao: number, rotulo: string, prefixo?: string) => {
    const ligada = !!r.metas[k] && !r.metas.metaDaLive;
    return (
      <label key={k} className="flex flex-wrap items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[rgb(var(--d-brand))]" checked={ligada} onChange={(e) => setR({ ...r, metas: { ...r.metas, metaDaLive: false, [k]: e.target.checked ? padrao : null } })} />
        <span className="w-16 text-d-ink2">a cada</span>
        {prefixo && <span className="text-d-ink2">{prefixo}</span>}
        <input
          type="number"
          min={1}
          disabled={!ligada}
          className="d-field w-28 disabled:opacity-40"
          value={(r.metas[k] as number | null) ?? padrao}
          onChange={(e) => mudaMeta(k, Number(e.target.value) || null)}
        />
        <span className={ligada ? "text-d-ink" : "text-d-ink3"}>{rotulo}</span>
      </label>
    );
  };

  return (
    <form
      className="d-pop-in d-card space-y-4 border-d-brand/50 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setOcupado(true);
        await aoSalvar({ id: inicial.id, nome, premio, regra: r });
        setOcupado(false);
      }}
    >
      <p className="text-lg font-bold">{individual ? "Meta individual" : "Regra de sorteio"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-d-ink2">
          Nome
          <input className="d-field" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-d-ink2">
          Prêmio (opcional)
          <input className="d-field" placeholder="Ex.: 1 booster" value={premio} onChange={(e) => setPremio(e.target.value)} />
        </label>
      </div>

      {!individual && (
        <div className="space-y-1.5">
          <p className="text-sm text-d-ink2">Quem concorre</p>
          <Escolha
            className="sm:inline-flex"
            valor={r.quem}
            mudar={(quem) => muda({ quem })}
            opcoes={[
              ["emocao", "quem mandou emotion"],
              ["compra", "quem comprou"],
              ["ambos", "os dois"],
            ]}
          />
        </div>
      )}

      {(individual || r.quem !== "compra") && (
        <div className="space-y-2">
          <p className="text-sm text-d-ink2">Emotions que contam</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              title="Conta qualquer emotion, inclusive as que aparecerem depois na live"
              onClick={() => muda({ icones: r.icones ? null : [] })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                !r.icones ? "border-d-gold bg-d-gold/15 text-d-gold" : "border-d-line bg-d-panel2 text-d-ink2 hover:border-d-ink3"
              }`}
            >
              <Sparkles className="size-3.5 shrink-0" />
              Todas as emotions
            </button>
            {todas.map((t) => (
              <ChipEmocao key={t.id} id={t.id} icones={d.icones} pts={t.pts} ligado={marcada(t.id)} onClick={() => alternar(t.id)} />
            ))}
          </div>
        </div>
      )}

      {individual ? (
        <div className="space-y-1.5">
          <p className="text-sm text-d-ink2">Cada pessoa que somar</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min={1} className="d-field w-28" value={r.alvo ?? 10} onChange={(e) => muda({ alvo: Number(e.target.value) || null })} />
            <Escolha
              valor={r.unidade ?? "emocoes"}
              mudar={(unidade) => muda({ unidade })}
              opcoes={[
                ["emocoes", "emotions"],
                ["pontos", "pontos"],
              ]}
            />
            <span className="text-sm text-d-ink2">ganha o prêmio</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm text-d-ink2">Quando o sorteio é liberado</p>
            <Escolha
              className="inline-flex"
              valor={r.liberacao}
              mudar={(liberacao) => muda({ liberacao, metas: liberacao === "metas" && !Object.values(r.metas).some(Boolean) ? { emocoes: 50 } : r.metas })}
              opcoes={[
                ["metas", "com metas"],
                ["livre", "sorteio livre"],
              ]}
            />
            {r.liberacao === "metas" && (
              <div className="space-y-2 rounded-2xl border border-d-line bg-d-panel2/50 p-3">
                <p className="text-xs text-d-ink3">Marque uma ou mais metas. Qualquer meta atingida libera 1 sorteio (as liberações se somam).</p>
                {linhaMeta("emocoes", 50, "emotions")}
                {linhaMeta("pontos", 5000, "pontos")}
                {linhaMeta("itens", 10, "itens vendidos")}
                {linhaMeta("reais", 1000, "vendidos", "R$")}
                {linhaMeta("ranking", 10000, "pontos ganhos no ranking da Jamble")}
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[rgb(var(--d-brand))]"
                    checked={!!r.metas.metaDaLive}
                    onChange={(e) => setR({ ...r, metas: e.target.checked ? { metaDaLive: true } : { emocoes: 50 } })}
                  />
                  <span className={r.metas.metaDaLive ? "text-d-ink" : "text-d-ink3"}>1 sorteio quando bater a meta da live</span>
                  <span className="text-xs text-d-ink3">· funciona sozinha (desmarca as outras metas)</span>
                  <span className="text-xs text-d-ink3">(defina a meta da live no topo da página)</span>
                </label>
              </div>
            )}
          </div>
          {r.quem !== "compra" && (
            <div className="space-y-1.5">
              <p className="text-sm text-d-ink2">Chance de quem mandou emotion</p>
              <Escolha
                valor={r.chance}
                mudar={(chance) => muda({ chance })}
                opcoes={[
                  ["pontos", "por pontos"],
                  ["quantidade", "por quantidade"],
                  ["igual", "igual"],
                ]}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-d-ink2 sm:col-span-2">
            <input type="checkbox" className="size-4 accent-[rgb(var(--d-brand))]" checked={r.repetir} onChange={(e) => muda({ repetir: e.target.checked })} />
            Quem já ganhou nesta regra pode ganhar de novo
          </label>
          <label className="flex items-center gap-2 text-sm text-d-ink2 sm:col-span-2">
            <input type="checkbox" className="size-4 accent-[rgb(var(--d-brand))]" checked={r.excluirSuspeitos} onChange={(e) => muda({ excluirSuspeitos: e.target.checked })} />
            Tirar contas em lote (nome inventado, nunca escrevem nem compram)
          </label>
        </div>
      )}

      <p className="rounded-xl bg-d-panel2 px-3 py-2 text-xs text-d-ink2">{descreverRegra(r)}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="d-btn d-btn-secondary px-4 py-2 text-sm" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="submit" disabled={ocupado} className="d-btn d-btn-primary px-5 py-2 text-sm">
          Salvar regra
        </button>
      </div>
    </form>
  );
}

// ---------- o centro do cartão: liberado? pronto? girando? ----------

function Situacao({ s, grande = false }: { s: SorteioCalculado; grande?: boolean }) {
  if (s.lib.livre) {
    return (
      <div>
        <p className={`font-bold text-d-gold ${grande ? "text-5xl" : "text-3xl"}`}>Sorteio livre</p>
        <p className="text-xs uppercase tracking-widest text-d-ink3">sorteie quando quiser</p>
      </div>
    );
  }
  const p = s.lib.proximo;
  return (
    <div className="space-y-2">
      {s.lib.disponiveis > 0 ? (
        <p className={`font-bold text-d-ok ${grande ? "text-5xl" : "text-3xl"}`}>{s.lib.disponiveis === 1 ? "1 sorteio liberado!" : `${s.lib.disponiveis} sorteios liberados!`}</p>
      ) : (
        <p className={`font-bold tabular-nums text-d-gold ${grande ? "text-5xl" : "text-3xl"}`}>{p ? `Faltam ${inteiro(Math.ceil(p.falta))}` : "Aguardando"}</p>
      )}
      <p className="text-xs uppercase tracking-widest text-d-ink3">{p ? `${p.unidade} para o próximo sorteio` : "meta da live"}</p>
      {p && (
        <div className="mx-auto max-w-xs">
          <Barra progresso={p.progresso} />
        </div>
      )}
      <p className="text-xs text-d-ink3">
        {inteiro(s.lib.liberados)} liberado(s) · {inteiro(s.validos.length)} sorteado(s)
      </p>
    </div>
  );
}

function Participantes({ s, aberto = false, comBilhetes = true }: { s: SorteioCalculado; aberto?: boolean; comBilhetes?: boolean }) {
  return (
    <details className="group border-t border-d-line" open={aberto}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-2.5 text-sm font-semibold hover:bg-d-panel2/50">
        Participantes e chances ({inteiro(s.concorrendo.length)})
        <ChevronDown className="size-4 shrink-0 text-d-ink3 transition group-open:rotate-180" />
      </summary>
      <div className="d-scroll max-h-64 overflow-y-auto">
        <ol className="divide-y divide-d-line">
          {s.concorrendo.slice(0, 300).map((p, i) => (
            <li key={p.handle} className="flex items-center gap-2.5 px-4 py-2">
              <span className="w-6 text-right text-xs tabular-nums text-d-ink3">{i + 1}</span>
              <Avatar foto={p.foto} nome={p.handle} tamanho={26} />
              <span className="min-w-0 flex-1 truncate text-sm">@{p.handle}</span>
              {comBilhetes && <span className="text-xs tabular-nums text-d-ink3">{inteiro(p.bilhetes)} bil.</span>}
              <span className="w-14 text-right text-sm font-semibold tabular-nums text-d-brand">
                {s.bilhetes ? ((p.bilhetes / s.bilhetes) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%
              </span>
            </li>
          ))}
        </ol>
        {s.participantes.some((p) => p.fora) && (
          <p className="border-t border-d-line px-4 py-2 text-xs text-d-ink3">
            Fora: {s.participantes.filter((p) => p.fora).map((p) => `@${p.handle} (${p.fora})`).join(", ")}
          </p>
        )}
      </div>
    </details>
  );
}

function Ganhadores({ s, acao, podeEditar }: { s: SorteioCalculado; acao: Acao; podeEditar: boolean }) {
  const lista = [...s.ganhadores].reverse();
  return (
    <div className="border-t border-d-line">
      <div className="flex items-center justify-between px-5 py-2.5">
        <h3 className="text-sm font-semibold">Ganhadores ({s.validos.length})</h3>
        {podeEditar && s.ganhadores.length > 0 && (
          <button className="text-xs text-d-ink3 hover:text-d-bad" onClick={() => confirm("Apagar todos os ganhadores deste sorteio?") && acao({ acao: "zerar", id: s.id })}>
            Zerar
          </button>
        )}
      </div>
      {lista.length > 0 && (
        <ol className="d-scroll max-h-56 divide-y divide-d-line overflow-y-auto">
          {lista.map((g) => {
            const n = s.ganhadores.indexOf(g) + 1;
            const valido = g.status === "valido";
            return (
              <li key={g.id} className={`flex items-center gap-3 px-5 py-2 ${valido ? "" : "opacity-45"}`}>
                <span className="w-7 text-sm font-bold text-d-ink3">#{n}</span>
                <Avatar foto={g.foto} nome={g.handle} tamanho={26} />
                <span className={`flex-1 truncate text-sm font-medium ${valido ? "" : "line-through"}`}>@{g.handle}</span>
                {podeEditar && valido && (
                  <>
                    <span className="inline-flex items-center gap-1" title="O ganhador estava na live?">
                      {([true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => acao({ acao: "presente", ganhadorId: g.id, presente: g.presente === v ? null : v })}
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] transition ${
                            g.presente === v
                              ? v
                                ? "border-d-ok bg-d-ok/15 text-d-ok"
                                : "border-d-bad bg-d-bad/15 text-d-bad"
                              : "border-d-line text-d-ink3 hover:bg-d-panel2 hover:text-d-ink"
                          }`}
                        >
                          {v ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                        </button>
                      ))}
                    </span>
                    <button
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-d-ink3 hover:bg-d-panel2 hover:text-d-ink"
                      title="O ganhador não respondeu: marcar e sortear outro para esta vaga"
                      onClick={() => acao({ acao: "resortear", id: s.id, ganhadorId: g.id })}
                    >
                      Re-sortear
                    </button>
                    <button className="rounded-md px-1 text-d-ink3 hover:text-d-ink" title="Copiar mensagem para o chat" onClick={() => copiar(mensagemDeGanhador(g.handle, s.premio))}>
                      📋
                    </button>
                  </>
                )}
                {!valido && <span className="text-[11px] text-d-ink3">{g.status === "resorteado" ? "re-sorteado" : "ausente"}</span>}
                <span className="text-xs text-d-ink3">{hora(g.ts)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function abrirJanela(chave: string, s: Sorteio, showId: string, f: "16x9" | "9x16") {
  const url = linkDaTela(chave, { s: s.id, f }).replace("/dash/tela?", `/dash/tela/sorteio/${encodeURIComponent(showId)}?`);
  const [w, h] = f === "16x9" ? [1280, 720] : [405, 720];
  window.open(url, `sorteio-${s.id}-${f}`, `width=${w},height=${h},menubar=no,toolbar=no,location=no`);
}

export function CartaoSorteio({
  s,
  showId,
  giro,
  acao,
  sortear,
  editar,
  podeEditar,
  volume,
  visual,
}: {
  s: SorteioCalculado;
  showId: string;
  giro: Giro | null;
  acao: Acao;
  sortear: (s: SorteioCalculado) => void;
  editar?: () => void;
  podeEditar: boolean;
  volume: number;
  visual: VisualDoSorteio;
}) {
  const chave = useContext(DashContexto)?.eu.config.telaChave;
  const individual = s.regra.tipo === "individual";
  const meuGiro = giro?.sorteioId === s.id ? giro : null;
  const travado = !s.lib.livre && s.lib.disponiveis <= 0;
  return (
    <section className="d-card relative flex flex-col overflow-hidden">
      <header className="space-y-3 border-b border-d-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${individual ? "bg-d-brand/15 text-d-brand" : "bg-d-gold/15 text-d-gold"}`}>
            {individual ? "Meta individual" : "Sorteio"}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            {!individual && podeEditar && chave && (
              <>
                <button className="d-btn d-btn-secondary d-btn-sm border-d-gold/50 text-d-gold" title="Abre só este sorteio numa janela horizontal (16:9), para capturar no OBS" onClick={() => abrirJanela(chave, s, showId, "16x9")}>
                  <Maximize2 className="size-3.5" />
                  Tela 16:9
                </button>
                <button className="d-btn d-btn-secondary d-btn-sm border-d-gold/50 text-d-gold" title="Abre só este sorteio numa janela vertical (9:16), para live no celular" onClick={() => abrirJanela(chave, s, showId, "9x16")}>
                  <Maximize2 className="size-3.5" />
                  Tela 9:16
                </button>
              </>
            )}
            {editar && (
              <button className="d-btn d-btn-secondary d-btn-sm" title="Editar este sorteio" onClick={editar}>
                <Pencil className="size-3.5" />
                Editar
              </button>
            )}
            {podeEditar && (
              <button className="d-btn d-btn-ghost d-btn-sm text-d-ink3 hover:text-d-bad" title="Excluir este sorteio" onClick={() => confirm(`Excluir "${s.nome}"?`) && acao({ acao: "excluir", id: s.id })}>
                Excluir
              </button>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-bold leading-snug tracking-tight [overflow-wrap:anywhere]">{s.nome}</h2>
          <p className="text-xs leading-relaxed text-d-ink3">
            {s.descricao}
            {s.premio ? ` · prêmio: ${s.premio}` : ""}
          </p>
        </div>
      </header>

      {individual && s.individual ? (
        <div className="px-5 py-5">
          <p className="text-center text-3xl font-bold text-d-brand">
            {inteiro(s.individual.bateram.length)} <span className="text-base font-semibold text-d-ink3">já bateram</span>
          </p>
          <p className="text-center text-xs uppercase tracking-widest text-d-ink3">
            meta: {inteiro(s.individual.alvo)} {s.regra.unidade === "pontos" ? "pontos" : "emotions"}
          </p>
          <ul className="d-scroll mt-4 max-h-72 divide-y divide-d-line overflow-y-auto">
            {[...s.individual.bateram, ...s.individual.faltam.slice(0, 30)].map((p) => {
              const ok = p.atual >= s.individual!.alvo;
              return (
                <li key={p.handle} className="flex items-center gap-3 py-2">
                  <Avatar foto={p.foto} nome={p.handle} tamanho={26} />
                  <span className="min-w-0 flex-1 truncate text-sm">@{p.handle}</span>
                  <span className="w-28">
                    <Barra progresso={s.individual!.alvo ? p.atual / s.individual!.alvo : 0} cor={ok ? "bg-d-ok" : "bg-d-brand"} />
                  </span>
                  <span className={`w-20 text-right text-xs font-semibold tabular-nums ${ok ? "text-d-ok" : "text-d-ink3"}`}>
                    {ok ? "bateu! ✓" : `${inteiro(p.atual)}/${inteiro(s.individual!.alvo)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          {!s.individual.bateram.length && !s.individual.faltam.length && <Vazio>Ninguém somou ainda.</Vazio>}
        </div>
      ) : (
        <>
          <div className="px-5 py-5 text-center">
            <Situacao s={s} />
            <div className="mt-5 flex min-h-32 flex-col items-center justify-center gap-2">
              {meuGiro ? (
                <GiroDoSorteio giro={meuGiro} visual={visual} volume={volume} />
              ) : (
                <p className="text-sm text-d-ink3">{s.concorrendo.length ? (travado ? "Ainda não liberou." : "Pronto para sortear.") : "Ninguém concorrendo ainda."}</p>
              )}
            </div>
            {podeEditar && (
              <button
                className="d-btn d-btn-primary mt-3 px-7 py-3 disabled:opacity-35"
                disabled={!s.concorrendo.length || travado || !!giro}
                onClick={() => sortear(s)}
              >
                Sortear agora
              </button>
            )}
            <p className="mt-2 text-xs text-d-ink3">
              {inteiro(s.concorrendo.length)} participantes · {inteiro(s.bilhetes)} bilhetes
            </p>
          </div>
          <Participantes s={s} />
          <Ganhadores s={s} acao={acao} podeEditar={podeEditar} />
        </>
      )}
    </section>
  );
}

// ---------- palco em tela cheia ----------

export function Palco({
  d,
  c,
  inicial,
  giro,
  sortear,
  aoFechar,
  editar,
  podeEditar,
  volume,
  mudo,
  setMudo,
  soUm = false,
}: {
  d: LiveCarregada;
  c: Contas;
  inicial?: string;
  giro: Giro | null;
  sortear: (s: SorteioCalculado) => void;
  aoFechar?: () => void;
  editar?: (s: SorteioCalculado) => void;
  podeEditar: boolean;
  volume: number;
  mudo: boolean;
  setMudo: (v: boolean) => void;
  soUm?: boolean;
}) {
  const lista = c.sorteios.filter((s) => s.regra.tipo === "sorteio");
  const [atual, setAtual] = useState(inicial ?? lista[0]?.id ?? "");
  const s = lista.find((x) => x.id === atual) ?? lista[0];
  const [min, setMin] = useState(2);
  const [seg, setSeg] = useState(0);
  const [fim, setFim] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const sortearRef = useRef(sortear);
  sortearRef.current = sortear;

  useEffect(() => {
    if (!fim) return;
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= fim) {
        setFim(null);
        if (s) sortearRef.current(s);
      }
    }, 200);
    return () => clearInterval(t);
  }, [fim, s]);

  const meuGiro = s && giro?.sorteioId === s.id ? giro : null;
  const travado = !!s && !s.lib.livre && s.lib.disponiveis <= 0;
  const restante = fim ? Math.max(0, Math.ceil((fim - agora) / 1000)) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-d-bg">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(900px 500px at 50% 35%, rgb(var(--d-brand) / 0.22), transparent 65%), radial-gradient(700px 400px at 50% 110%, rgb(var(--d-gold) / 0.12), transparent 60%)" }}
      />
      <header className="relative z-10 flex flex-wrap items-center gap-3 border-b border-d-line/70 px-5 py-3">
        <p className="text-lg font-bold tracking-tight">
          Dash <span className="text-d-brand">Village</span> <span className="text-d-gold">· Sorteio</span>
        </p>
        {!soUm && (
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {lista.map((x) => (
              <button
                key={x.id}
                onClick={() => setAtual(x.id)}
                className={`rounded-full px-3 py-1 text-sm transition ${x.id === s?.id ? "bg-d-brand font-semibold text-d-on-brand" : "bg-d-panel2 text-d-ink2 hover:text-d-ink"}`}
              >
                {x.nome}
              </button>
            ))}
          </div>
        )}
        {soUm && <span className="flex-1" />}
        <button className="d-btn d-btn-secondary d-btn-sm" title={mudo ? "Ligar o som" : "Silenciar"} onClick={() => setMudo(!mudo)}>
          {mudo ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          Som
        </button>
        {aoFechar && (
          <button className="flex items-center gap-1 rounded-xl bg-d-panel2 px-3 py-1.5 text-sm font-semibold hover:bg-d-line" onClick={aoFechar}>
            <X className="size-4" />
            Sair
          </button>
        )}
      </header>
      {s ? (
        <div className={`relative z-10 grid min-h-0 flex-1 gap-5 p-5 ${soUm ? "" : "lg:grid-cols-[1fr_360px]"}`}>
          <section className="d-card flex min-h-0 flex-col items-center justify-between gap-6 p-6 text-center">
            <div className="-mb-2 flex w-full justify-end">
              {editar && podeEditar && (
                <button className="d-btn d-btn-secondary d-btn-sm" onClick={() => editar(s)}>
                  <Pencil className="size-3.5" />
                  Editar
                </button>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-d-ink3">{s.nome}</p>
              <p className="text-xs text-d-ink3">{s.descricao}</p>
              {s.premio && <p className="text-lg font-semibold text-d-gold">🎁 {s.premio}</p>}
            </div>
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-4">
              {podeEditar && !meuGiro && (
                <form
                  className="flex flex-wrap items-center justify-center gap-2 text-sm text-d-ink3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFim(fim ? null : Date.now() + (min * 60 + seg) * 1000);
                  }}
                >
                  <Timer className="size-4" />
                  <span>Começar em</span>
                  <input type="number" min={0} className="d-field w-16 px-2 py-1 text-center" value={min} onChange={(e) => setMin(Math.max(0, Number(e.target.value) || 0))} />
                  <span>min</span>
                  <input type="number" min={0} max={59} className="d-field w-16 px-2 py-1 text-center" value={seg} onChange={(e) => setSeg(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} />
                  <span>s</span>
                  <button type="submit" className="d-btn d-btn-secondary d-btn-sm" disabled={!s.concorrendo.length || travado}>
                    {fim ? "Parar cronômetro" : "Iniciar cronômetro"}
                  </button>
                </form>
              )}
              <div className="w-full max-w-3xl">
                {meuGiro ? (
                  <GiroDoSorteio giro={meuGiro} visual={d.visual} volume={mudo ? 0 : volume} grande />
                ) : fim ? (
                  <div>
                    <p key={restante} className="text-8xl font-bold tabular-nums text-d-gold" style={{ animation: "dPopIn .4s ease-out" }}>
                      {Math.floor(restante / 60) > 0 ? `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}` : restante}
                    </p>
                    <p className="text-xs uppercase tracking-widest text-d-ink3">o sorteio começa sozinho</p>
                  </div>
                ) : (
                  <Situacao s={s} grande />
                )}
              </div>
            </div>
            <div className="space-y-2">
              {podeEditar && (
                <button
                  className="rounded-3xl bg-d-gold px-14 py-5 text-3xl font-bold tracking-wide text-d-on-gold shadow-[0_0_60px_rgb(var(--d-gold)/0.35)] transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!s.concorrendo.length || travado || !!giro}
                  onClick={() => sortear(s)}
                >
                  SORTEAR
                </button>
              )}
              <p className="text-sm text-d-ink3">{inteiro(s.concorrendo.length)} participantes concorrendo</p>
            </div>
          </section>
          {!soUm && (
            <aside className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="d-card flex min-h-0 flex-1 flex-col overflow-hidden">
                <header className="d-card-header">
                  <h2 className="d-card-title">
                    <Users className="size-4 shrink-0 text-d-brand" />
                    <span className="truncate">Participantes ({inteiro(s.concorrendo.length)})</span>
                  </h2>
                </header>
                <div className="d-scroll min-h-0 flex-1 overflow-y-auto">
                  <ol className="divide-y divide-d-line">
                    {s.concorrendo.slice(0, 200).map((p, i) => (
                      <li key={p.handle} className="flex items-center gap-2.5 px-4 py-2">
                        <span className="w-6 text-right text-xs tabular-nums text-d-ink3">{i + 1}</span>
                        <Avatar foto={p.foto} nome={p.handle} tamanho={26} />
                        <span className="min-w-0 flex-1 truncate text-sm">@{p.handle}</span>
                        <span className="text-xs tabular-nums text-d-ink3">{inteiro(p.bilhetes)} bil.</span>
                        <span className="w-14 text-right text-sm font-semibold tabular-nums text-d-brand">
                          {s.bilhetes ? ((p.bilhetes / s.bilhetes) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <Emotions d={d} c={c} altura="min-h-0 flex-1" />
            </aside>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 items-center justify-center text-d-ink3">Nenhum sorteio criado nesta live.</div>
      )}
    </div>
  );
}

// ---------- sortear (com a roleta) ----------

export function useSortear(showId: string, trocar: (m: { sorteios: Sorteio[] }) => void, volume: number, duracaoMs = 6500) {
  const token = useContext(DashContexto)?.token ?? "";
  const [giro, setGiro] = useState<Giro | null>(null);
  const [erro, setErro] = useState("");

  const acao: Acao = async (corpo) => {
    setErro("");
    if (!token) {
      setErro("Entre no Dash neste navegador para sortear.");
      return null;
    }
    try {
      const r = await chamarApi<{ sorteios: Sorteio[]; ganhador?: Pessoa & { id: string }; roleta?: Pessoa[] }>(token, `/api/dash/sorteios/${encodeURIComponent(showId)}`, { corpo });
      if (r.ganhador && r.roleta) {
        const s = r.sorteios.find((x) => x.id === corpo.id);
        setGiro({ chave: r.ganhador.id, sorteioId: String(corpo.id), ganhador: r.ganhador, lista: r.roleta, premio: s?.premio ?? null, nome: s?.nome ?? "" });
        // A lista nova (com o ganhador) entra quando a roleta para; o giro
        // fica na tela mais uns segundos (com a música terminando).
        setTimeout(() => {
          trocar({ sorteios: r.sorteios });
          setTimeout(() => setGiro(null), 7000);
        }, duracaoMs + 300);
      } else {
        trocar({ sorteios: r.sorteios });
      }
      return r;
    } catch (e) {
      setErro(String((e as Error).message));
      tocar("lance", volume);
      return null;
    }
  };
  const sortear = (s: SorteioCalculado) => acao({ acao: "sortear", id: s.id });
  return { giro, erro, setErro, acao, sortear };
}

// ---------- a página ----------

function MetaDaLive({ d, c, showId, aoMudar }: { d: LiveCarregada; c: Contas; showId: string; aoMudar: (m: Meta[]) => void }) {
  const { chamar } = useDash();
  const [alvo, setAlvo] = useState(c.metaLive ? String(c.metaLive.alvo) : "");
  const [tipo, setTipo] = useState(c.metaLive?.tipo === "emocoes" ? "emocoes" : "ranking");
  useEffect(() => {
    setAlvo(c.metaLive ? String(c.metaLive.alvo) : "");
    if (c.metaLive) setTipo(c.metaLive.tipo === "emocoes" ? "emocoes" : "ranking");
  }, [c.metaLive?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudou = alvo !== (c.metaLive ? String(c.metaLive.alvo) : "") || (c.metaLive && tipo !== c.metaLive.tipo);
  return (
    <form
      className="d-card flex flex-wrap items-center gap-2 px-4 py-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await chamar<{ metas: Meta[] }>(`/api/dash/metas/${encodeURIComponent(showId)}`, { corpo: { acao: "meta-live", tipo, alvo: Number(alvo.replace(/\D/g, "")) || 0 } }).catch(() => null);
        if (r) aoMudar(r.metas);
      }}
    >
      <span className="flex items-center gap-1.5 text-sm text-d-ink2">
        <Target className="size-4 shrink-0 text-d-brand" />
        Meta:
      </span>
      <input inputMode="numeric" placeholder="ex.: 260000" className="d-field w-32 px-3 py-1.5 text-sm" aria-label="Meta de pontos" value={alvo} onChange={(e) => setAlvo(e.target.value)} />
      <span className="text-sm text-d-ink2">pontos de</span>
      <select className="d-field px-3 py-1.5 text-sm" aria-label="Origem dos pontos" value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="ranking">Ranking mensal da Jamble</option>
        <option value="emocoes">Emotions desta live</option>
      </select>
      <button type="submit" disabled={!mudou} className="d-btn d-btn-primary d-btn-sm">
        Salvar meta
      </button>
      {c.metaLive && (
        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <span className="flex-1">
            <Barra progresso={c.metaLive.alvo ? c.atualMeta / c.metaLive.alvo : 0} cor={c.metaBatida ? "bg-d-ok" : "bg-d-gold"} />
          </span>
          <span className={`text-sm font-semibold tabular-nums ${c.metaBatida ? "text-d-ok" : ""}`}>
            {c.metaBatida ? "Meta batida! 🎉" : `${inteiro(c.atualMeta)} / ${inteiro(c.metaLive.alvo)}`}
          </span>
        </div>
      )}
      <p className="w-full text-xs text-d-ink3">
        Ranking mensal: os pontos que o vendedor já tem no mês (+3 por R$ gasto, +2 por gema), atualizados a cada leitura do ranking
        {d.ranking ? "" : " — abra o ranking mensal na Jamble uma vez para a extensão ler"}.
      </p>
    </form>
  );
}

// O jeito do sorteio (vale para a conta toda, no painel e na tela do OBS): o
// pião ou a fita, e a música -- a marchinha do Dash, um arquivo enviado ou
// nenhuma.
function ConfigDoSorteio({ visual, volume, aoMudar }: { visual: VisualDoSorteio; volume: number; aoMudar: (v: VisualDoSorteio) => void }) {
  const { chamar, eu } = useDash();
  const dono = eu.membro.papel === "dono";
  const [estado, setEstado] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const tocando = useRef<{ musica: Tocando; tempos: ReturnType<typeof setTimeout>[] } | null>(null);

  const pararDeOuvir = () => {
    tocando.current?.tempos.forEach(clearTimeout);
    tocando.current?.musica.parar(300);
    tocando.current = null;
    setOuvindo(false);
  };
  useEffect(() => pararDeOuvir, []);

  async function salvar(novo: VisualDoSorteio) {
    aoMudar(novo);
    await chamar("/api/dash/eu", { metodo: "PATCH", corpo: { preferencias: { sorteio: novo } } }).catch((e) => setEstado(String((e as Error).message)));
  }

  async function enviar(f: File) {
    setEstado("Enviando a música…");
    try {
      const tipo = f.type || "audio/mpeg";
      const r = await chamar<{ caminho: string; token: string; url: string }>("/api/dash/musica", { corpo: { nome: f.name, tipo, tamanho: f.size } });
      const sb = supabaseNavegador();
      if (!sb) throw new Error("Sem conexão com o armazenamento.");
      const { error } = await sb.storage.from("dash-musicas").uploadToSignedUrl(r.caminho, r.token, f, { contentType: tipo });
      if (error) throw new Error(error.message);
      const antiga = visual.musicaUrl;
      await salvar({ ...visual, musica: "arquivo", musicaUrl: r.url, musicaNome: f.name });
      if (antiga && antiga !== r.url) chamar(`/api/dash/musica?url=${encodeURIComponent(antiga)}`, { metodo: "DELETE" }).catch(() => {});
      setEstado("");
    } catch (e) {
      setEstado((e as Error).message || "Não consegui enviar a música.");
    }
  }

  // Ouve como fica: o tempo do giro e a fanfarra no fim.
  function ouvir() {
    if (ouvindo) return pararDeOuvir();
    destravarAudio();
    const musica = tocarMusica({ tipo: visual.musica, url: visual.musicaUrl }, volume || 1);
    const t1 = setTimeout(() => musica.vitoria(), DURACAO_PIAO);
    const t2 = setTimeout(pararDeOuvir, DURACAO_PIAO + (visual.musica === "arquivo" ? 4500 : 2600));
    tocando.current = { musica, tempos: [t1, t2] };
    setOuvindo(true);
  }

  const chip = (ativo: boolean) => `d-chip ${ativo ? "d-chip-on" : ""} disabled:cursor-default disabled:opacity-70`;
  return (
    <section className="d-card flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="d-label pr-1">Roleta</span>
        <button className={chip(visual.estilo === "piao")} disabled={!dono} onClick={() => salvar({ ...visual, estilo: "piao" })} title="O tambor do Pião da Casa Própria, com os nomes passando">
          Pião
        </button>
        <button className={chip(visual.estilo === "fita")} disabled={!dono} onClick={() => salvar({ ...visual, estilo: "fita" })} title="A fita com as fotos passando">
          Fita
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="d-label inline-flex items-center gap-1 pr-1">
          <Music className="size-3.5" />
          Música
        </span>
        <button className={chip(visual.musica === "padrao")} disabled={!dono} onClick={() => salvar({ ...visual, musica: "padrao" })} title="Marchinha de auditório feita pelo Dash">
          Marchinha do Dash
        </button>
        {visual.musicaUrl && (
          <button className={chip(visual.musica === "arquivo")} disabled={!dono} onClick={() => salvar({ ...visual, musica: "arquivo" })} title={visual.musicaNome ?? "Sua música"}>
            <span className="inline-block max-w-[180px] truncate align-bottom">{visual.musicaNome ?? "Sua música"}</span>
          </button>
        )}
        <button className={chip(visual.musica === "nenhuma")} disabled={!dono} onClick={() => salvar({ ...visual, musica: "nenhuma" })}>
          Sem música
        </button>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {estado && <span className="text-xs text-d-ink3">{estado}</span>}
        {dono && (
          <>
            <input
              ref={arquivo}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) enviar(f);
              }}
            />
            <button className="d-btn d-btn-secondary d-btn-sm" onClick={() => arquivo.current?.click()} title="Envie o MP3 da música que vai tocar enquanto o pião gira (até 20 MB)">
              <Upload className="size-3.5" />
              Enviar música
            </button>
          </>
        )}
        <button className="d-btn d-btn-secondary d-btn-sm" onClick={ouvir} disabled={visual.musica === "nenhuma"}>
          {ouvindo ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
          {ouvindo ? "Parar" : "Ouvir"}
        </button>
      </div>
    </section>
  );
}

export default function Sorteios({ showId }: { showId: string }) {
  const { definirLiveAberta } = useDash();
  const { dados: d, erro, trocar } = useLiveDash(showId);
  const c = useContasLive(d);
  const [volume, setVolume] = usePreferencia("volume", 1);
  const [mudo, setMudo] = usePreferencia("sorteio-mudo", false);
  const [sons] = usePreferencia("sons", true);
  const [form, setForm] = useState<{ id?: string; nome: string; premio: string; regra: Regra } | null>(null);
  const [palco, setPalco] = useState(false);
  const { recados, novo } = useRecados();
  const { giro, erro: erroAcao, acao, sortear } = useSortear(showId, trocar, mudo ? 0 : volume, d ? duracaoDoGiro(d.visual) : DURACAO_PIAO);
  useAvisos(d, c, { sons: sons && !mudo, volume, voz: false, novo });

  useEffect(() => {
    if (d) definirLiveAberta({ showId, titulo: d.live.titulo, vendedor: d.live.vendedor });
  }, [d?.live.titulo, d?.live.vendedor, showId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d || !c) {
    return (
      <main className="d-page flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-d-ink3">
        <span className="size-6 animate-spin rounded-full border-2 border-d-line border-t-d-brand" />
        {erro ? `Não consegui abrir a live: ${erro}` : "Abrindo a live…"}
      </main>
    );
  }

  async function salvar(f: { id?: string; nome: string; premio: string; regra: Regra }) {
    const r = await acao({ acao: f.id ? "editar" : "criar", id: f.id, nome: f.nome, premio: f.premio, regra: f.regra });
    if (r) setForm(null);
  }

  const editar = (s: Sorteio) => setForm({ id: s.id, nome: s.nome, premio: s.premio ?? "", regra: s.regra });

  return (
    <main className="d-page">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="d-page-title">Sorteios &amp; Metas</h1>
          <p className="d-page-sub">
            @{d.live.vendedor} · {d.live.titulo}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusLive aoVivo={d.live.aoVivo} />
        </div>
      </header>

      <section className="d-card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button className="d-btn d-btn-primary" onClick={() => setForm({ nome: "Novo sorteio", premio: "", regra: regraPadrao("sorteio") })}>
            <Plus className="size-4 shrink-0" />
            Novo sorteio
          </button>
          <button className="d-btn d-btn-secondary" onClick={() => setForm({ nome: "Nova meta", premio: "", regra: regraPadrao("individual") })}>
            <Target className="size-4 shrink-0" />
            Nova meta individual
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="d-label pr-1">Modelos</span>
          {MODELOS.map((m) => (
            <button
              key={m.rotulo}
              className="d-chip inline-flex items-center gap-1.5"
              title={`Novo "${m.nome}" (sorteio livre)`}
              onClick={() => acao({ acao: "criar", nome: m.nome, regra: { ...regraPadrao("sorteio"), ...m.regra } })}
            >
              <Sparkles className="size-3.5 shrink-0 text-d-gold" />
              {m.rotulo}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="d-btn d-btn-secondary border-d-gold/60 text-d-gold" title="Palco do sorteio em tela cheia, para mostrar na live" onClick={() => setPalco(true)}>
            <Maximize2 className="size-4 shrink-0" />
            Tela cheia
          </button>
          <button className="d-btn d-btn-secondary px-2.5" title={mudo ? "Ligar o som do sorteio" : "Silenciar o sorteio"} aria-label="Silenciar o sorteio" onClick={() => setMudo(!mudo)}>
            {mudo ? <VolumeX className="size-4 shrink-0" /> : <Volume2 className="size-4 shrink-0" />}
          </button>
          <Volume valor={volume} mudar={setVolume} />
        </div>
      </section>

      <ConfigDoSorteio visual={d.visual} volume={mudo ? 0 : volume} aoMudar={(visual) => trocar({ visual })} />

      {erroAcao && <p className="rounded-xl border border-d-bad/40 bg-d-bad/10 px-4 py-2.5 text-sm text-d-bad">{erroAcao}</p>}

      <MetaDaLive d={d} c={c} showId={showId} aoMudar={(metas) => trocar({ metas })} />

      <MensagensChat d={d} c={c} recados={recados} novo={novo} />

      <Emotions d={d} c={c} altura="h-[420px]" />

      {form && <FormRegra key={form.id ?? form.regra.tipo} d={d} inicial={form} aoSalvar={salvar} aoFechar={() => setForm(null)} />}

      {c.sorteios.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {c.sorteios.map((s) => (
            <CartaoSorteio key={s.id} s={s} showId={showId} giro={giro} acao={acao} sortear={sortear} editar={() => editar(s)} podeEditar={d.podeEditar} volume={mudo ? 0 : volume} visual={d.visual} />
          ))}
        </div>
      ) : (
        !form && (
          <section className="d-card">
            <Vazio>Nenhum sorteio nesta live. Clique em “Novo sorteio” ou num modelo.</Vazio>
          </section>
        )
      )}

      {palco && (
        <Palco d={d} c={c} giro={giro} sortear={sortear} aoFechar={() => setPalco(false)} editar={(s) => { setPalco(false); editar(s); }} podeEditar={d.podeEditar} volume={volume} mudo={mudo} setMudo={setMudo} />
      )}
    </main>
  );
}
