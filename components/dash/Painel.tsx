"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Volume2, VolumeX } from "lucide-react";
import { lerTermos } from "@/lib/dash/calculos";
import { haQuanto, inteiro, reais, useAgora, useDash, useLiveDash, usePreferencia } from "@/lib/dash/cliente";
import {
  Chat,
  Emotions,
  AssistindoAgora,
  Engajamento,
  Leiloeiro,
  MensagensChat,
  PontosPorUsuario,
  PorProduto,
  RankingCarpas,
  RankingCompradores,
  useAvisos,
  useContasLive,
  useRecados,
  Vendas,
} from "@/components/dash/blocos";
import { Avatar, Kpi, StatusLive, Volume } from "@/components/dash/ui";

// O Painel da live, na mesma ordem do Dash TCG: cabeçalho com os controles,
// termos da carpa, mensagens para o chat, os números, o leiloeiro e as listas.

export function useTermos(termosDaLive: string | undefined, aoMudar: (t: string) => void) {
  const { chamar, eu, recarregarEu } = useDash();
  const [texto, setTexto] = useState(termosDaLive ?? "");
  useEffect(() => setTexto(termosDaLive ?? ""), [termosDaLive]);
  const salvar = async (novo: string) => {
    setTexto(novo);
    aoMudar(novo);
    await chamar("/api/dash/eu", { metodo: "PATCH", corpo: { termosCarpa: novo } }).catch(() => {});
    recarregarEu();
  };
  const alternar = (icone: string) => {
    const lista = lerTermos(texto);
    salvar((lista.includes(icone) ? lista.filter((t) => t !== icone) : [...lista, icone]).join(", "));
  };
  return { texto, setTexto, salvar, alternar, podeMudar: eu.membro.papel === "dono" };
}

export default function Painel({ showId }: { showId: string }) {
  const { definirLiveAberta } = useDash();
  const { dados: d, erro, reconectar, trocar } = useLiveDash(showId);
  const c = useContasLive(d);
  const agora = useAgora(5000);
  const [sons, setSons] = usePreferencia("sons", true);
  const [volume, setVolume] = usePreferencia("volume", 1);
  // A voz do leiloeiro vem desligada (pedido de 20/10/2026); a chave nova faz
  // valer também onde ela já estava ligada. O botão do leilão religa.
  const [voz, setVoz] = usePreferencia("voz-leiloeiro", false);
  const [ocultar, setOcultar] = usePreferencia("ocultar", false);
  const [limpoEm, setLimpoEm] = usePreferencia(`limpo:${showId}`, 0);
  const { recados, novo } = useRecados();
  const termos = useTermos(d?.termos, (t) => trocar({ termos: t }));
  useAvisos(d, c, { sons, volume, voz, novo });

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

  const live = d.live;
  const m = live.metricas ?? {};
  const atrasada = live.aoVivo && agora - live.vistoEm > 60000;
  const id = encodeURIComponent(showId);

  return (
    <main className={`d-page-wide ${ocultar ? "dash-ocultar" : ""}`}>
      <header className="d-card flex flex-wrap items-center gap-3 px-4 py-3.5">
        <div className="flex min-w-[240px] flex-1 basis-full items-center gap-3 xl:basis-0">
          <Avatar foto={live.vendedorFoto ?? live.capa} nome={live.vendedor} tamanho={40} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight">{live.titulo || "Live"}</p>
            <p className={`truncate text-sm ${atrasada ? "text-d-warn" : "text-d-ink3"}`}>
              @{live.vendedor} ·{" "}
              {live.aoVivo
                ? atrasada
                  ? `Ao vivo — a extensão mandou dados ${haQuanto(live.vistoEm, agora)}; confira a aba da live no Edge`
                  : "Ao vivo agora"
                : "Live encerrada — mostrando o histórico salvo"}
            </p>
          </div>
        </div>
        <button
          title={sons ? `Sons ligados: venda (caixa registradora), pagamento (moedas), ${d.visual.nome} liberado e meta batida — clique para silenciar` : "Sons desligados"}
          className={`d-btn d-btn-secondary d-btn-sm ${sons ? "text-d-gold" : "text-d-ink3"}`}
          onClick={() => setSons(!sons)}
        >
          {sons ? <Volume2 className="size-4 shrink-0" /> : <VolumeX className="size-4 shrink-0" />}
          Sons
        </button>
        <Volume valor={volume} mudar={setVolume} />
        <button
          aria-pressed={ocultar}
          title="Ocultar dados de vendas (total, itens, compradores e produtos)"
          className={`d-btn d-btn-secondary d-btn-sm ${ocultar ? "text-d-brand" : "text-d-ink2"}`}
          onClick={() => setOcultar(!ocultar)}
        >
          {ocultar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          Ocultar valores
        </button>
        <StatusLive aoVivo={live.aoVivo} />
        <div className="flex flex-wrap gap-2">
          <Link target="_blank" className="d-btn d-btn-primary d-btn-sm" href={`/dash/sorteios/${id}`}>
            Abrir sorteio
          </Link>
          <Link target="_blank" title="Chat, diamantes e sorteios sem dados de vendas — para compartilhar a tela" className="d-btn d-btn-secondary d-btn-sm" href={`/dash/tela/${id}`}>
            Tela p/ compartilhar
          </Link>
          <button className="d-btn d-btn-secondary d-btn-sm" onClick={reconectar}>
            Reconectar
          </button>
          <button className="d-btn d-btn-ghost d-btn-sm" onClick={() => setLimpoEm(limpoEm ? 0 : Date.now())} title="Esconde das listas o que já passou (os totais continuam)">
            {limpoEm ? "Mostrar histórico" : "Limpar histórico"}
          </button>
        </div>
      </header>

      <label className="d-card flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
        <span className="shrink-0 text-sm font-medium text-d-ink2">Termos da carpa dourada:</span>
        <input
          className="d-field min-w-0 flex-1 font-mono"
          value={termos.texto}
          disabled={!termos.podeMudar}
          onChange={(e) => termos.setTexto(e.target.value)}
          onBlur={() => termos.texto !== d.termos && termos.salvar(termos.texto)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </label>

      <MensagensChat d={d} c={c} recados={recados} novo={novo} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Espectadores" valor={inteiro(Number(live.audiencia ?? m.audienciaAgora ?? 0))} />
        <Kpi rotulo="Curtidas" valor={inteiro(Number(live.likes ?? m.likes ?? 0))} />
        <Kpi rotulo="Carpas douradas" valor={inteiro(c.totalCarpas)} cor="text-d-gold" />
        <Kpi rotulo="Vendas" valor={inteiro(c.resumo.vendas)} dinheiro />
        <Kpi rotulo="Itens vendidos" valor={inteiro(c.resumo.itens)} dinheiro />
        <Kpi rotulo="Total vendido" valor={reais(Math.max(c.resumo.pago, 0))} cor="text-d-ok" dinheiro />
      </div>

      <Leiloeiro d={d} voz={voz} setVoz={setVoz} />

      <div className="grid gap-4 lg:grid-cols-3">
        <RankingCarpas c={c} />
        <Emotions d={d} c={c} alternarTermo={termos.podeMudar ? termos.alternar : undefined} limpoEm={limpoEm} />
        <Chat d={d} limpoEm={limpoEm} />
        <PontosPorUsuario c={c} />
        <RankingCompradores c={c} />
        <Vendas d={d} limpoEm={limpoEm} />
        <PorProduto c={c} />
        <AssistindoAgora d={d} c={c} />
        <Engajamento d={d} c={c} />
      </div>
    </main>
  );
}
