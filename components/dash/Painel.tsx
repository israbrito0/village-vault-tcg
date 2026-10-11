"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Gift,
  MessageSquareText,
  Mic,
  MicOff,
  RefreshCw,
  Trash2,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  engajamento,
  lerTermos,
  marcos,
  mensagemDeMetaBatida,
  mensagemDeSorteioLiberado,
  mensagemDeStatus,
  nomeDaFonte,
  pareceRobo,
  participantes,
  pontosDaLive,
  pontosPorPessoa,
  porIcone,
  porProduto,
  progressoMeta,
  rankingCarpas,
  rankingCompradores,
  resumoVendas,
  tipoDeMeta,
  totalDaFonte,
  type Totais,
} from "@/lib/dash/calculos";
import {
  copiar,
  duracao,
  haQuanto,
  hora,
  inteiro,
  linkDaTela,
  reais,
  useAgora,
  useDash,
  useLiveDash,
  usePreferencia,
  type LiveCarregada,
} from "@/lib/dash/cliente";
import { falar, reaisFalado, tocar, vozes } from "@/lib/dash/som";
import { AoVivo, Avatar, Barra, Botao, Cartao, IconeEmocao, Kpi, Rolagem, Selo, Vazio } from "@/components/dash/ui";

type Recado = { id: string; texto: string; ts: number; tipo: "status" | "sorteio" | "meta" | "ganhador" };

const VOZ_PADRAO = { ligada: false, volume: 1, velocidade: 1.1, voz: "", leilao: true, lances: true, vendas: true, carpas: true, sorteios: true, metas: true };
const SOM_PADRAO = { ligado: true, volume: 0.5 };
const STATUS_PADRAO = { minutos: 0, sorteio: true, meta: true };

// Tudo que dá para tirar de uma live carregada, de uma vez.
function useContas(d: LiveCarregada | null) {
  return useMemo(() => {
    if (!d) return null;
    const termos = lerTermos(d.termos);
    const resumo = resumoVendas(d.vendas);
    const carpas = rankingCarpas(d.emocoes, d.chat, termos);
    const totalCarpas = carpas.reduce((s, p) => s + p.carpas, 0);
    const gemas = d.emocoes.reduce((s, e) => s + (e.gemas || 0), 0);
    const eng = engajamento(d.emocoes, d.chat, d.vendas);
    const suspeitos = eng.filter((p) => pareceRobo(p.handle, p));
    const pontosLive = pontosDaLive(resumo.total, gemas, d.ranking?.regras);
    // Pontos do ranking desde a última leitura oficial: soma o que entrou depois.
    let estimado: number | null = null;
    if (d.ranking?.pontos != null && d.souVendedor) {
      const t = d.ranking.ts;
      const vendido = d.vendas.filter((v) => !v.cancelado && v.ts > t).reduce((s, v) => s + v.total, 0);
      const g = d.emocoes.filter((e) => e.ts > t).reduce((s, e) => s + e.gemas, 0);
      estimado = pontosDaLive(vendido, g, d.ranking.regras) + d.ranking.pontos;
    }
    const totais: Totais = {
      gemas,
      carpas: totalCarpas,
      emocoes: d.emocoes.length,
      faturamento: resumo.total,
      itens: resumo.itens,
      compradores: resumo.compradores,
      pontosLive,
      posicao: d.ranking?.posicao ?? null,
    };
    const vendedor = d.live.vendedor;
    const sorteios = d.sorteios.map((s) => {
      const validos = s.ganhadores.filter((g) => g.status === "valido");
      const fora = s.ganhadores.filter((g) => g.status !== "valido").map((g) => g.handle);
      const lista = participantes(
        { fonte: s.fonte, peso: s.peso, repetir: s.repetir, excluirSuspeitos: s.excluirSuspeitos, excluir: [...s.excluir, ...fora] },
        { emocoes: d.emocoes, mensagens: d.chat, vendas: d.vendas, termos, vendedor },
        validos.map((g) => g.handle),
      );
      const ok = lista.filter((p) => !p.fora);
      // Total cru da fonte (para "a cada N"): sem peso e sem exclusões.
      const cru = participantes(
        { fonte: s.fonte, peso: "quantidade", repetir: true, excluirSuspeitos: false, excluir: [] },
        { emocoes: d.emocoes, mensagens: d.chat, vendas: d.vendas, termos, vendedor: null },
      );
      const totalFonte = s.fonte === "gemas" ? d.emocoes.reduce((t, e) => t + e.gemas, 0) : totalDaFonte(cru.map((p) => ({ n: p.bilhetes })));
      return {
        ...s,
        concorrendo: ok.length,
        bilhetes: ok.reduce((t, p) => t + p.bilhetes, 0),
        marcos: s.modo === "meta" && s.aCada ? marcos(s.aCada, totalFonte, validos.length) : null,
        fonteNome: nomeDaFonte(s.fonte, Object.fromEntries(Object.entries(d.icones).map(([k, v]) => [k, v.nome ?? k]))),
      };
    });
    const metas = d.metas.map((m) => ({ ...m, ...progressoMeta(m, totais), unidade: tipoDeMeta(m.tipo).unidade }));
    // Participação da Jamble (só na live do próprio vendedor): conta a live
    // inteira, mesmo o tempo em que a aba ficou fechada.
    const oficial = (d.live.participacao ?? []).filter((p) => p.handle && (Number(p.gemas) || 0) > 0);
    return {
      termos,
      resumo,
      carpas,
      totalCarpas,
      gemas,
      pontos: pontosPorPessoa(d.emocoes),
      oficial: oficial.sort((a, b) => (Number(b.gemas) || 0) - (Number(a.gemas) || 0)),
      compradores: rankingCompradores(d.vendas),
      produtos: porProduto(d.vendas),
      eng,
      suspeitos,
      icones: porIcone(d.emocoes),
      pontosLive,
      estimado,
      totais,
      sorteios,
      metas,
    };
  }, [d]);
}

export default function Painel({ showId }: { showId: string }) {
  const { eu, chamar } = useDash();
  const { dados, erro, reconectar, trocar } = useLiveDash(showId);
  const c = useContas(dados);
  const agora = useAgora(1000);

  const [som, setSom] = usePreferencia("som", SOM_PADRAO);
  const [voz, setVoz] = usePreferencia("voz", VOZ_PADRAO);
  const [ocultar, setOcultar] = usePreferencia("ocultar", false);
  const [status, setStatus] = usePreferencia("status", STATUS_PADRAO);
  const [limpoEm, setLimpoEm] = usePreferencia(`limpo:${showId}`, 0);
  const [verVoz, setVerVoz] = useState(false);
  const [recados, setRecados] = useState<Recado[]>([]);
  const [copiado, setCopiado] = useState("");
  const [listaVozes, setListaVozes] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const pegar = () => setListaVozes(vozes());
    pegar();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = pegar;
  }, []);

  const recado = (texto: string, tipo: Recado["tipo"]) =>
    setRecados((r) => [{ id: `${Date.now()}-${Math.random()}`, texto, ts: Date.now(), tipo }, ...r].slice(0, 20));

  // ---------- o que mudou desde a última busca: som, voz e recados ----------
  const antes = useRef<{
    vendas: Set<string>;
    emocoes: number;
    carpas: number;
    leilao: string;
    melhor: number;
    liberados: Record<string, number>;
    batidas: Set<string>;
    ganhadores: Set<string>;
  } | null>(null);
  const ultimaFala = useRef(0);

  useEffect(() => {
    if (!dados || !c) return;
    const leilao = dados.live.leilao;
    const atual = {
      vendas: new Set(dados.vendas.filter((v) => !v.cancelado).map((v) => v.id)),
      emocoes: dados.emocoes.length,
      carpas: c.totalCarpas,
      leilao: leilao?.id ?? "",
      melhor: Number(leilao?.melhor) || 0,
      liberados: Object.fromEntries(c.sorteios.map((s) => [s.id, s.marcos?.liberados ?? 0])),
      batidas: new Set(c.metas.filter((m) => m.batida).map((m) => m.id)),
      ganhadores: new Set(dados.sorteios.flatMap((s) => s.ganhadores.map((g) => g.id))),
    };
    const a = antes.current;
    antes.current = atual;
    if (!a) return; // primeira carga: só anota

    const dizer = (texto: string, tipo: keyof typeof VOZ_PADRAO) => {
      if (voz.ligada && voz[tipo]) falar(texto, { voz: voz.voz, volume: voz.volume, velocidade: voz.velocidade });
    };

    const novas = dados.vendas.filter((v) => !v.cancelado && !a.vendas.has(v.id));
    if (novas.length) {
      if (som.ligado) tocar("venda", som.volume);
      if (novas.length === 1) {
        const v = novas[0];
        dizer(`Vendido! ${v.titulo} para ${v.comprador ?? "alguém"} por ${reaisFalado(v.total)}`, "vendas");
      } else {
        dizer(`${novas.length} vendas novas, ${reaisFalado(novas.reduce((s, v) => s + v.total, 0))}`, "vendas");
      }
    }

    const maisCarpas = c.totalCarpas - a.carpas;
    if (maisCarpas > 0) {
      if (som.ligado) tocar("carpa", som.volume);
      const ultima = dados.emocoes[dados.emocoes.length - 1];
      dizer(maisCarpas === 1 && ultima ? `${ultima.nome || ultima.handle} mandou carpa dourada` : `Mais ${maisCarpas} carpas douradas`, "carpas");
    } else if (dados.emocoes.length > a.emocoes && som.ligado) {
      tocar("tique", som.volume * 0.6);
    }

    if (leilao?.id && leilao.id !== a.leilao && leilao.situacao !== "vendido") {
      dizer(`Novo ${leilao.tipo === "BUY_IT_NOW" || leilao.tipo === "compra direta" ? "produto" : "leilão"}: ${leilao.titulo ?? ""}${leilao.inicial ? `, começa em ${reaisFalado(leilao.inicial)}` : ""}`, "leilao");
    } else if (leilao?.id === a.leilao && atual.melhor > a.melhor) {
      if (som.ligado) tocar("lance", som.volume);
      // Lance atrás de lance: fala no máximo a cada 2,5 s, sempre o mais novo.
      if (Date.now() - ultimaFala.current > 2500) {
        ultimaFala.current = Date.now();
        dizer(`${reaisFalado(atual.melhor)}${leilao.vencedor ? `, ${leilao.vencedor}` : ""}`, "lances");
      }
    }

    for (const s of c.sorteios) {
      const antesLib = a.liberados[s.id] ?? 0;
      if (s.marcos && s.marcos.liberados > antesLib) {
        if (som.ligado) tocar("sorteio", som.volume);
        dizer(`Sorteio liberado: ${s.nome}`, "sorteios");
        if (status.sorteio) recado(mensagemDeSorteioLiberado(s.nome, s.premio), "sorteio");
      }
    }
    for (const m of c.metas) {
      if (m.batida && !a.batidas.has(m.id) && m.escopo === "live") {
        if (som.ligado) tocar("meta", som.volume);
        dizer(`Meta batida: ${m.nome || tipoDeMeta(m.tipo).nome}`, "metas");
        if (status.meta) recado(mensagemDeMetaBatida(m.nome || tipoDeMeta(m.tipo).nome), "meta");
        if (!m.batidaEm) chamar(`/api/dash/metas/${encodeURIComponent(showId)}`, { corpo: { acao: "bater", id: m.id } }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  // ---------- status para o chat, de tempos em tempos ----------
  const gerarStatus = () => {
    if (!c || !dados) return;
    const proximo = c.sorteios.find((s) => s.ativo && s.marcos && s.marcos.faltaParaProximo > 0);
    const meta = c.metas.find((m) => m.ativo && m.escopo === "live" && !m.batida && m.tipo !== "posicao");
    const r = dados.ranking;
    recado(
      mensagemDeStatus({
        carpas: c.totalCarpas,
        vendas: c.resumo.vendas,
        posicao: dados.souVendedor ? r?.posicao : null,
        faltaAcima: dados.souVendedor && r?.acima && c.estimado != null ? r.acima.pontos - c.estimado : null,
        proximoSorteio: proximo?.marcos ? { nome: proximo.nome, falta: proximo.marcos.faltaParaProximo, unidade: proximo.fonteNome.unidade } : null,
        meta: meta ? { nome: meta.nome || tipoDeMeta(meta.tipo).nome, falta: meta.falta ?? 0, unidade: meta.unidade } : null,
        topCarpa: c.carpas[0]?.handle ?? null,
      }),
      "status",
    );
  };
  const gerarStatusRef = useRef(gerarStatus);
  gerarStatusRef.current = gerarStatus;
  useEffect(() => {
    if (!status.minutos) return;
    const t = setInterval(() => {
      gerarStatusRef.current();
      if (som.ligado) tocar("tique", som.volume);
    }, status.minutos * 60000);
    return () => clearInterval(t);
  }, [status.minutos, som.ligado, som.volume]);

  async function copiarRecado(r: Recado) {
    await copiar(r.texto);
    setCopiado(r.id);
    setTimeout(() => setCopiado(""), 1500);
  }

  async function copiarTela() {
    await copiar(linkDaTela(eu.config.telaChave, { v: "geral", f: "16x9", show: showId }));
    setCopiado("tela");
    setTimeout(() => setCopiado(""), 2000);
  }

  if (!dados || !c) {
    return <p className="py-10 text-center text-[13px] text-[#8b93a7]">{erro ? `Não consegui abrir a live: ${erro}` : "Carregando a live..."}</p>;
  }

  const live = dados.live;
  const m = live.metricas ?? {};
  const atraso = agora - live.vistoEm;
  const recente = <T extends { ts: number }>(l: T[]) => l.filter((x) => x.ts >= limpoEm);
  const r = dados.ranking;
  const leilao = live.leilao;

  return (
    <div className={ocultar ? "dash-ocultar" : ""}>
      {/* ---------- cabeçalho ---------- */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="min-w-0 truncate font-display text-lg font-extrabold text-white">{live.titulo || "Live"}</h1>
        <AoVivo aoVivo={live.aoVivo} />
        <span className="text-[12px] text-[#8b93a7]">@{live.vendedor}</span>
        {!dados.souVendedor && <Selo cor="azul">acompanhando outra live</Selo>}
        <span className={`text-[12px] ${live.aoVivo && atraso > 60000 ? "text-[#ff8a8a]" : "text-[#8b93a7]"}`}>
          extensão mandou {haQuanto(live.vistoEm, agora)}
          {live.aoVivo && atraso > 60000 && " — confira se a aba da live está aberta no Edge"}
        </span>
        {erro && <Selo cor="vermelho">sem conexão: {erro}</Selo>}
      </div>

      {/* ---------- controles ---------- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Botao ativo={som.ligado} onClick={() => setSom({ ...som, ligado: !som.ligado })} titulo="Sons de venda, carpa e lance">
          {som.ligado ? <Volume2 size={14} /> : <VolumeX size={14} />} Sons
        </Botao>
        {som.ligado && (
          <input type="range" min={0} max={1} step={0.05} value={som.volume} onChange={(e) => setSom({ ...som, volume: Number(e.target.value) })} className="w-20 accent-[#F4AF14]" aria-label="Volume" />
        )}
        <Botao ativo={voz.ligada} onClick={() => setVerVoz(!verVoz)} titulo="Leiloeiro: lê vendas, lances e carpas em voz alta">
          {voz.ligada ? <Mic size={14} /> : <MicOff size={14} />} Leiloeiro {voz.ligada ? "ligado" : "desligado"}
        </Botao>
        <Botao ativo={ocultar} onClick={() => setOcultar(!ocultar)} titulo="Borra os valores em dinheiro">
          {ocultar ? <EyeOff size={14} /> : <Eye size={14} />} Ocultar valores
        </Botao>
        <Link href={`/dash/sorteios/${encodeURIComponent(showId)}`}>
          <Botao>
            <Gift size={14} /> Abrir sorteio
          </Botao>
        </Link>
        <Botao onClick={copiarTela} titulo="Link da tela limpa desta live, para o OBS">
          <Tv size={14} /> {copiado === "tela" ? "Link copiado!" : "Tela p/ compartilhar"}
        </Botao>
        <Botao onClick={reconectar} titulo="Busca tudo de novo">
          <RefreshCw size={14} /> Reconectar
        </Botao>
        <Botao onClick={() => setLimpoEm(limpoEm ? 0 : Date.now())} titulo="Esconde das listas o que já passou (os totais continuam)">
          <Trash2 size={14} /> {limpoEm ? `Histórico limpo às ${hora(limpoEm)} — mostrar tudo` : "Limpar histórico"}
        </Botao>
      </div>

      {verVoz && (
        <Cartao titulo="Leiloeiro — voz" className="mb-4">
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <Botao cor={voz.ligada ? "vermelho" : "verde"} onClick={() => setVoz({ ...voz, ligada: !voz.ligada })}>
              {voz.ligada ? "Desligar voz" : "Ligar voz"}
            </Botao>
            {(["leilao", "lances", "vendas", "carpas", "sorteios", "metas"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="checkbox" checked={voz[k]} onChange={(e) => setVoz({ ...voz, [k]: e.target.checked })} className="accent-[#F4AF14]" />
                {{ leilao: "novo leilão", lances: "lances", vendas: "vendas", carpas: "carpas", sorteios: "sorteio liberado", metas: "meta batida" }[k]}
              </label>
            ))}
            <label className="flex items-center gap-1.5">
              volume
              <input type="range" min={0} max={1} step={0.05} value={voz.volume} onChange={(e) => setVoz({ ...voz, volume: Number(e.target.value) })} className="w-20 accent-[#F4AF14]" />
            </label>
            <label className="flex items-center gap-1.5">
              velocidade
              <input type="range" min={0.7} max={1.6} step={0.05} value={voz.velocidade} onChange={(e) => setVoz({ ...voz, velocidade: Number(e.target.value) })} className="w-20 accent-[#F4AF14]" />
            </label>
            <select value={voz.voz} onChange={(e) => setVoz({ ...voz, voz: e.target.value })} className="rounded-lg border border-white/10 bg-[#0f1116] px-2 py-1">
              <option value="">voz padrão (português)</option>
              {listaVozes.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
            <Botao onClick={() => falar("Dou-lhe uma, dou-lhe duas, vendido!", { voz: voz.voz, volume: voz.volume, velocidade: voz.velocidade })}>Testar</Botao>
          </div>
        </Cartao>
      )}

      {/* ---------- números ---------- */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Espectadores" valor={live.audiencia != null ? inteiro(live.audiencia) : "—"} detalhe={m.pico ? `pico ${inteiro(Number(m.pico))}` : live.pico ? `pico ${inteiro(live.pico)}` : undefined} />
        <Kpi rotulo="Curtidas" valor={live.likes != null ? inteiro(live.likes) : "—"} />
        <Kpi rotulo="Carpas douradas" valor={inteiro(c.totalCarpas)} cor="text-brand-yellow" detalhe={`${inteiro(c.gemas)} gemas em ${inteiro(dados.emocoes.length)} emotions`} />
        <Kpi rotulo="Vendas" valor={inteiro(c.resumo.vendas)} detalhe={`${inteiro(c.resumo.compradores)} compradores`} />
        <Kpi rotulo="Itens vendidos" valor={inteiro(c.resumo.itens)} detalhe={c.resumo.canceladas ? `${c.resumo.canceladas} canceladas` : undefined} />
        <Kpi rotulo="Total vendido" valor={reais(c.resumo.total)} cor="text-[#6fdc94]" dinheiro detalhe={c.resumo.pendente > 0 ? `${reais(c.resumo.pendente)} pendente` : "tudo pago"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {/* ---------- ranking mensal ---------- */}
        {dados.souVendedor && (
          <Cartao titulo={`Ranking mensal${r ? ` · ${r.mes}` : ""}`}>
            {r ? (
              <>
                <div className="flex items-end gap-3">
                  <p className="font-display text-4xl font-extrabold text-brand-yellow">{r.posicao ? `#${r.posicao}` : "—"}</p>
                  <div className="pb-1 text-[12px] text-[#8b93a7]">
                    <p>{r.pontos != null ? `${inteiro(r.pontos)} pts oficiais (${haQuanto(r.ts, agora)})` : "fora do top"}</p>
                    {c.estimado != null && <p className="text-white/80">≈ {inteiro(c.estimado)} pts agora</p>}
                  </div>
                </div>
                {r.acima && c.estimado != null && (
                  <p className="mt-2 text-[12px]">
                    Faltam <b className="text-white">{inteiro(Math.max(0, r.acima.pontos - c.estimado))}</b> pts para o #{r.acima.posicao} (@{r.acima.handle})
                  </p>
                )}
                {r.abaixo && c.estimado != null && (
                  <p className="text-[12px] text-[#8b93a7]">
                    {inteiro(Math.max(0, c.estimado - r.abaixo.pontos))} pts à frente do #{r.abaixo.posicao} (@{r.abaixo.handle})
                  </p>
                )}
                <p className="mt-2 text-[12px] text-[#8b93a7]">Esta live rendeu ≈ {inteiro(c.pontosLive)} pts.</p>
              </>
            ) : (
              <Vazio>Abra o ranking mensal na Jamble uma vez: a extensão guarda e o painel estima ao vivo.</Vazio>
            )}
          </Cartao>
        )}

        {/* ---------- leilão agora ---------- */}
        <Cartao titulo="Leilão agora">
          {leilao && leilao.situacao !== "vendido" && leilao.situacao !== "sem venda" ? (
            <div>
              <p className="font-semibold text-white">{leilao.titulo ?? "Produto"}</p>
              <div className="mt-2 flex items-end gap-4">
                <p className="font-display text-3xl font-extrabold text-[#6fdc94] dash-valor">{reais(Number(leilao.melhor || leilao.inicial || 0))}</p>
                <div className="pb-1 text-[12px] text-[#8b93a7]">
                  {leilao.vencedor && <p className="text-white">na frente: @{leilao.vencedor}</p>}
                  <p>
                    {inteiro(leilao.lances ?? 0)} lances · {inteiro(leilao.disputaram ?? 0)} disputando
                  </p>
                </div>
              </div>
              {leilao.termina && leilao.termina > agora && <p className="mt-1 text-[12px] text-brand-yellow">termina em {Math.ceil((leilao.termina - agora) / 1000)}s</p>}
            </div>
          ) : (
            <Vazio>Nenhum leilão rolando agora.</Vazio>
          )}
          {live.batalha && !live.batalha.acabou && (
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b93a7]">Batalha</p>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-bold text-[#ff8a8a]">🔴 {inteiro(live.batalha.vermelho.pontos)}</span>
                <span className="flex-1">
                  <Barra
                    progresso={live.batalha.vermelho.pontos / Math.max(1, live.batalha.vermelho.pontos + live.batalha.azul.pontos)}
                    cor="bg-brand-red"
                  />
                </span>
                <span className="font-bold text-[#7cc7f0]">{inteiro(live.batalha.azul.pontos)} 🔵</span>
              </div>
            </div>
          )}
        </Cartao>

        {/* ---------- mensagens para o chat ---------- */}
        <Cartao
          titulo="Mensagens para o chat"
          acao={
            <Botao onClick={gerarStatus}>
              <MessageSquareText size={13} /> Gerar status agora
            </Botao>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-[#8b93a7]">Sugerir status:</span>
            {[0, 5, 10, 15].map((n) => (
              <Botao key={n} ativo={status.minutos === n} onClick={() => setStatus({ ...status, minutos: n })}>
                {n ? `${n} min` : "desligado"}
              </Botao>
            ))}
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={status.sorteio} onChange={(e) => setStatus({ ...status, sorteio: e.target.checked })} className="accent-[#F4AF14]" />
              sorteio liberado
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={status.meta} onChange={(e) => setStatus({ ...status, meta: e.target.checked })} className="accent-[#F4AF14]" />
              meta batida
            </label>
          </div>
          <Rolagem altura="max-h-56">
            {recados.length ? (
              <ul className="space-y-2">
                {recados.map((x) => (
                  <li key={x.id} className="dash-entrar flex items-start gap-2 rounded-lg bg-white/[0.04] p-2">
                    <p className="min-w-0 flex-1 text-[12px] text-white/90">{x.texto}</p>
                    <Botao onClick={() => copiarRecado(x)}>
                      <Copy size={12} /> {copiado === x.id ? "Copiado" : "Copiar"}
                    </Botao>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>As mensagens prontas aparecem aqui. Copie e cole no chat da Jamble.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- sorteios e metas (resumo) ---------- */}
        <Cartao
          titulo="Sorteios & metas"
          acao={
            <Link href={`/dash/sorteios/${encodeURIComponent(showId)}`} className="text-[11px] font-semibold text-brand-yellow hover:underline">
              gerenciar
            </Link>
          }
        >
          {!c.sorteios.length && !c.metas.length && <Vazio>Nenhum sorteio ou meta nesta live.</Vazio>}
          <ul className="space-y-3">
            {c.sorteios.map((s) => (
              <li key={s.id}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">{s.nome}</span>
                  {s.marcos && s.marcos.disponiveis > 0 && <Selo cor="verde">{s.marcos.disponiveis} liberado(s)</Selo>}
                  <span className="text-[11px] text-[#8b93a7]">{s.concorrendo} concorrendo</span>
                </div>
                {s.marcos && (
                  <div className="mt-1">
                    <Barra progresso={s.marcos.progresso} />
                    <p className="mt-0.5 text-[11px] text-[#8b93a7]">
                      faltam {inteiro(s.marcos.faltaParaProximo)} {s.fonteNome.unidade} para o próximo
                    </p>
                  </div>
                )}
              </li>
            ))}
            {c.metas.map((x) => (
              <li key={x.id}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">🎯 {x.nome || tipoDeMeta(x.tipo).nome}</span>
                  {x.escopo === "live" && x.batida && <Selo cor="verde">batida!</Selo>}
                  {x.escopo === "pessoa" && <Selo cor="azul">por pessoa</Selo>}
                </div>
                {x.escopo === "live" && x.tipo !== "posicao" && (
                  <div className="mt-1">
                    <Barra progresso={x.progresso} cor={x.batida ? "bg-brand-green" : "bg-brand-yellow"} />
                    <p className={`mt-0.5 text-[11px] text-[#8b93a7] ${x.tipo === "faturamento" ? "dash-valor" : ""}`}>
                      {inteiro(x.atual)} de {inteiro(x.alvo)} {x.unidade}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Cartao>

        {/* ---------- ranking de carpas ---------- */}
        <Cartao titulo={`Ranking de carpas · ${inteiro(c.totalCarpas)}`}>
          <Rolagem>
            {c.carpas.length ? (
              <ol className="space-y-1.5">
                {c.carpas.slice(0, 50).map((p, i) => (
                  <li key={p.handle} className="flex items-center gap-2 text-[13px]">
                    <span className="w-6 text-right text-[11px] text-[#8b93a7]">{i + 1}</span>
                    <Avatar foto={p.foto} nome={p.handle} tamanho={24} />
                    <span className="min-w-0 flex-1 truncate">@{p.handle}</span>
                    {c.suspeitos.some((s) => s.handle === p.handle) && <Selo cor="vermelho">suspeita</Selo>}
                    <span className="font-bold text-brand-yellow">{inteiro(p.carpas)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Vazio>Nenhuma carpa ainda.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- emotions ---------- */}
        <Cartao titulo={`Emotions · ${inteiro(dados.emocoes.length)}`}>
          <div className="mb-3 flex flex-wrap gap-2">
            {c.icones.map((i) => (
              <span key={i.icone} className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 text-[12px]" title={`${inteiro(i.gemas)} gemas`}>
                <IconeEmocao id={i.icone} icones={dados.icones} tamanho={20} />
                <b>{inteiro(i.qtd)}</b>
              </span>
            ))}
          </div>
          <Rolagem altura="max-h-60">
            {recente(dados.emocoes).length ? (
              <ul className="space-y-1">
                {recente(dados.emocoes)
                  .slice(-40)
                  .reverse()
                  .map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-[12px]">
                      <span className="w-10 text-[10px] text-[#8b93a7]">{hora(e.ts)}</span>
                      <Avatar foto={e.foto} nome={e.handle} tamanho={20} />
                      <span className="min-w-0 flex-1 truncate">@{e.handle}</span>
                      <IconeEmocao id={e.icone} icones={dados.icones} tamanho={18} />
                      <span className="w-12 text-right text-[11px] text-[#8b93a7]">{e.gemas} 💎</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <Vazio>Nenhuma emotion {limpoEm ? "desde a limpeza" : "ainda"}.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- chat ---------- */}
        <Cartao titulo={`Chat · ${inteiro(dados.chat.length)}`}>
          <Rolagem altura="max-h-96">
            {recente(dados.chat).length ? (
              <ul className="space-y-1.5">
                {recente(dados.chat)
                  .slice(-80)
                  .reverse()
                  .map((x) => (
                    <li key={x.id} className="flex items-start gap-2 text-[12px]">
                      <Avatar foto={x.foto} nome={x.handle} tamanho={20} />
                      <p className="min-w-0 flex-1">
                        <span className="font-semibold text-white/70">@{x.handle}</span> <span className="text-white/90">{x.texto}</span>
                      </p>
                      <span className="text-[10px] text-[#8b93a7]">{hora(x.ts)}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <Vazio>Nenhuma mensagem {limpoEm ? "desde a limpeza" : "ainda"}.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- pontos por usuário ---------- */}
        <Cartao titulo={c.oficial.length ? "Pontos por usuário (pela Jamble)" : "Pontos por usuário (gemas)"}>
          <Rolagem>
            {c.oficial.length ? (
              <ol className="space-y-1.5">
                {c.oficial.slice(0, 50).map((p, i) => (
                  <li key={p.handle} className="flex items-center gap-2 text-[13px]">
                    <span className="w-6 text-right text-[11px] text-[#8b93a7]">{i + 1}</span>
                    <Avatar foto={p.foto} nome={p.handle} tamanho={24} />
                    <span className="min-w-0 flex-1 truncate">@{p.handle}</span>
                    <span className="font-bold text-white">{inteiro(Number(p.gemas) || 0)} 💎</span>
                  </li>
                ))}
              </ol>
            ) : c.pontos.length ? (
              <ol className="space-y-1.5">
                {c.pontos.slice(0, 50).map((p, i) => (
                  <li key={p.handle} className="flex items-center gap-2 text-[13px]">
                    <span className="w-6 text-right text-[11px] text-[#8b93a7]">{i + 1}</span>
                    <Avatar foto={p.foto} nome={p.handle} tamanho={24} />
                    <span className="min-w-0 flex-1 truncate">@{p.handle}</span>
                    <span className="text-[11px] text-[#8b93a7]">{p.emocoes}×</span>
                    <span className="font-bold text-white">{inteiro(p.gemas)} 💎</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Vazio>Ninguém mandou gemas ainda.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- compradores ---------- */}
        <Cartao titulo="Ranking de compradores">
          <Rolagem>
            {c.compradores.length ? (
              <ol className="space-y-1.5">
                {c.compradores.slice(0, 50).map((p, i) => (
                  <li key={p.handle} className="flex items-center gap-2 text-[13px]">
                    <span className="w-6 text-right text-[11px] text-[#8b93a7]">{i + 1}</span>
                    <Avatar foto={p.foto} nome={p.handle} tamanho={24} />
                    <span className="min-w-0 flex-1 truncate">@{p.handle}</span>
                    <span className="text-[11px] text-[#8b93a7]">{p.itens} itens</span>
                    <span className="dash-valor font-bold text-[#6fdc94]">{reais(p.pago)}</span>
                    {p.total > p.pago && <span className="dash-valor text-[11px] text-[#ff8a8a]">+{reais(p.total - p.pago)}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <Vazio>Nenhuma venda ainda.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- vendas ---------- */}
        <Cartao titulo={`Vendas · ${inteiro(c.resumo.vendas)}`}>
          <Rolagem>
            {recente(dados.vendas).length ? (
              <ul className="space-y-1.5">
                {recente(dados.vendas)
                  .slice()
                  .reverse()
                  .map((v) => (
                    <li key={v.id} className={`flex items-center gap-2 text-[12px] ${v.cancelado ? "opacity-40 line-through" : ""}`}>
                      <span className="w-10 text-[10px] text-[#8b93a7]">{hora(v.ts)}</span>
                      {v.imagem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.imagem} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                      ) : (
                        <Avatar foto={v.foto} nome={v.comprador} tamanho={28} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-white/90">{v.titulo}</p>
                        <p className="truncate text-[11px] text-[#8b93a7]">
                          @{v.comprador ?? "?"} · {v.tipo === "BUY_IT_NOW" ? "compra direta" : v.tipo === "SUDDEN_DEATH" ? "morte súbita" : "leilão"}
                          {v.quantidade > 1 && ` · ${v.quantidade} un.`}
                        </p>
                      </div>
                      <span className="dash-valor font-bold text-white">{reais(v.total)}</span>
                      {v.pago === false && !v.cancelado && <Selo cor="vermelho">pendente</Selo>}
                    </li>
                  ))}
              </ul>
            ) : (
              <Vazio>Nenhuma venda {limpoEm ? "desde a limpeza" : "ainda"}.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- por produto ---------- */}
        <Cartao titulo="Vendidos por produto (pagos)">
          <Rolagem>
            {c.produtos.length ? (
              <table className="w-full text-[12px]">
                <thead className="text-left text-[10px] uppercase tracking-wider text-[#8b93a7]">
                  <tr>
                    <th className="pb-1 font-semibold">Produto</th>
                    <th className="pb-1 text-right font-semibold">Qtd</th>
                    <th className="pb-1 text-right font-semibold">Médio</th>
                    <th className="pb-1 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {c.produtos.map((p) => (
                    <tr key={p.titulo} className="border-t border-white/[0.05]">
                      <td className="max-w-0 truncate py-1.5 pr-2" title={`${p.vendas} vendas · ${p.compradores} compradores`}>
                        {p.titulo}
                      </td>
                      <td className="py-1.5 text-right">{inteiro(p.qtd)}</td>
                      <td className="dash-valor py-1.5 text-right text-[#8b93a7]">{reais(p.medio)}</td>
                      <td className="dash-valor py-1.5 text-right font-semibold">{reais(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Vazio>Nada pago ainda.</Vazio>
            )}
          </Rolagem>
        </Cartao>

        {/* ---------- engajamento ---------- */}
        <Cartao titulo={`Engajamento por espectador · ${inteiro(c.eng.length)} pessoas`} className="lg:col-span-2">
          <Rolagem>
            <table className="w-full text-[12px]">
              <thead className="text-left text-[10px] uppercase tracking-wider text-[#8b93a7]">
                <tr>
                  <th className="pb-1 font-semibold">Pessoa</th>
                  <th className="pb-1 text-right font-semibold">Mensagens</th>
                  <th className="pb-1 text-right font-semibold">Emotions</th>
                  <th className="pb-1 text-right font-semibold">Compras</th>
                  <th className="pb-1 text-right font-semibold">Tempo ativo</th>
                </tr>
              </thead>
              <tbody>
                {c.eng.slice(0, 100).map((p) => (
                  <tr key={p.handle} className="border-t border-white/[0.05]">
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <Avatar foto={p.foto} nome={p.handle} tamanho={20} />
                        <span className="truncate">@{p.handle}</span>
                      </span>
                    </td>
                    <td className="py-1.5 text-right">{p.mensagens}</td>
                    <td className="py-1.5 text-right">{p.emocoes}</td>
                    <td className="py-1.5 text-right">{p.compras}</td>
                    <td className="py-1.5 text-right text-[#8b93a7]">
                      {p.ativoMs > 0 ? `${duracao(p.ativoMs)} (${hora(p.primeira)}–${hora(p.ultima)})` : hora(p.primeira)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Rolagem>
        </Cartao>

        {/* ---------- contas suspeitas ---------- */}
        <Cartao
          titulo={
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={12} /> Contas suspeitas · {c.suspeitos.length}
            </span>
          }
        >
          <p className="mb-2 text-[12px] text-[#8b93a7]">
            Contas em lote (15 letras, nome inventado, nunca escrevem nem compram). Ficam fora dos sorteios — dá para incluir de volta no sorteio.
          </p>
          <Rolagem altura="max-h-60">
            {c.suspeitos.length ? (
              <ul className="space-y-1">
                {c.suspeitos.map((p) => (
                  <li key={p.handle} className="flex items-center gap-2 text-[12px]">
                    <Avatar foto={p.foto} nome={p.handle} tamanho={20} />
                    <span className="min-w-0 flex-1 truncate">@{p.handle}</span>
                    <span className="text-[11px] text-[#8b93a7]">{p.emocoes} emotions</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhuma.</Vazio>
            )}
          </Rolagem>
        </Cartao>
      </div>
    </div>
  );
}
