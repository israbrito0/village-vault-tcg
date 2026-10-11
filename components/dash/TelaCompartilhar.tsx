"use client";

import Link from "next/link";
import { useContext, useState } from "react";
import { ArrowLeft, Ticket, Volume2, VolumeX } from "lucide-react";
import { DashContexto, inteiro, useLiveDash, usePreferencia } from "@/lib/dash/cliente";
import { Chat, Emotions, Leiloeiro, PontosPorUsuario, RankingCarpas, useAvisos, useContasLive, useRecados } from "@/components/dash/blocos";
import { CartaoSorteio, duracaoDoGiro, Palco, useSortear } from "@/components/dash/Sorteios";
import { Logo } from "@/components/dash/DashShell";
import { Avatar, Kpi, StatusLive, Vazio, Volume } from "@/components/dash/ui";

// Tela p/ compartilhar: chat, emotions e sorteios da live, sem nenhum dado de
// venda -- para mostrar na transmissão (captura de janela ou fonte do OBS).

export function TelaCompartilhar({ showId, chave }: { showId: string; chave?: string }) {
  const dash = useContext(DashContexto);
  const { dados: d, erro, trocar } = useLiveDash(showId, 3000, chave);
  const c = useContasLive(d);
  const [sons, setSons] = usePreferencia("sons", true);
  const [volume, setVolume] = usePreferencia("volume", 1);
  const [voz, setVoz] = usePreferencia("voz", true);
  const [mudo, setMudo] = usePreferencia("sorteio-mudo", false);
  const { novo } = useRecados();
  useAvisos(d, c, { sons, volume, voz, novo });
  const podeEditar = !!dash && !!d?.podeEditar;

  if (!d || !c) {
    return (
      <main className="d-page flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-d-ink3">
        <span className="size-6 animate-spin rounded-full border-2 border-d-line border-t-d-brand" />
        {erro ? (erro.includes("acesso") ? "Entre no Dash neste navegador ou use o link com a chave." : `Não consegui abrir a live: ${erro}`) : "Abrindo a live…"}
      </main>
    );
  }
  const live = d.live;
  return (
    <main className="d-page-wide">
      <header className="d-card flex flex-wrap items-center gap-4 px-4 py-3">
        {dash && (
          <Link className="d-btn d-btn-secondary d-btn-sm" title="Voltar ao painel desta live" href={`/dash/painel/${encodeURIComponent(showId)}`}>
            <ArrowLeft className="size-4 shrink-0" />
            Voltar ao painel
          </Link>
        )}
        <Logo texto="text-lg" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar foto={live.vendedorFoto ?? live.capa} nome={live.vendedor} tamanho={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{live.titulo}</p>
            <p className="truncate text-sm text-d-ink3">@{live.vendedor}</p>
          </div>
        </div>
        <button
          title={sons ? "Sons ligados: venda, pagamento, Pião da Village TCG liberado e meta batida — clique para silenciar" : "Sons desligados"}
          className={`d-btn d-btn-secondary d-btn-sm ${sons ? "text-d-gold" : "text-d-ink3"}`}
          onClick={() => setSons(!sons)}
        >
          {sons ? <Volume2 className="size-4 shrink-0" /> : <VolumeX className="size-4 shrink-0" />}
        </button>
        <Volume valor={volume} mudar={setVolume} />
        <StatusLive aoVivo={live.aoVivo} />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Kpi rotulo="Espectadores" valor={inteiro(Number(live.audiencia ?? 0))} />
        <Kpi rotulo="Curtidas" valor={inteiro(Number(live.likes ?? 0))} />
        <Kpi rotulo="Carpas douradas" valor={inteiro(c.totalCarpas)} cor="text-d-gold" />
      </div>

      <Leiloeiro d={{ ...d, vendas: [] }} voz={voz} setVoz={setVoz} />

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <RankingCarpas c={c} />
        <Emotions d={d} c={c} />
        <PontosPorUsuario c={c} altura="h-[520px]" />
        <Chat d={d} />
      </div>

      <SorteiosDaTela d={d} c={c} showId={showId} trocar={trocar} podeEditar={podeEditar} volume={volume} mudo={mudo} setMudo={setMudo} />
    </main>
  );
}

function SorteiosDaTela({
  d,
  c,
  showId,
  trocar,
  podeEditar,
  volume,
  mudo,
  setMudo,
}: {
  d: NonNullable<ReturnType<typeof useLiveDash>["dados"]>;
  c: NonNullable<ReturnType<typeof useContasLive>>;
  showId: string;
  trocar: ReturnType<typeof useLiveDash>["trocar"];
  podeEditar: boolean;
  volume: number;
  mudo: boolean;
  setMudo: (v: boolean) => void;
}) {
  const [palco, setPalco] = useState(false);
  const { giro, erro, acao, sortear } = useSortear(showId, trocar, mudo ? 0 : volume, duracaoDoGiro(d.visual));
  const lista = c.sorteios.filter((s) => s.ativo);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex flex-1 items-center gap-2 text-lg font-semibold">
          <Ticket className="size-5 shrink-0 text-d-brand" />
          Sorteios
        </h2>
        {podeEditar && (
          <button className="d-btn d-btn-secondary border-d-gold/60 text-d-gold" onClick={() => setPalco(true)}>
            Tela cheia
          </button>
        )}
        <button className="d-btn d-btn-secondary" title={mudo ? "Ligar o som do sorteio" : "Silenciar o sorteio"} onClick={() => setMudo(!mudo)}>
          {mudo ? <VolumeX className="size-4 shrink-0" /> : <Volume2 className="size-4 shrink-0" />}
        </button>
      </div>
      {erro && <p className="rounded-xl border border-d-bad/40 bg-d-bad/10 px-4 py-2.5 text-sm text-d-bad">{erro}</p>}
      {lista.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {lista.map((s) => (
            <CartaoSorteio key={s.id} s={s} showId={showId} giro={giro} acao={acao} sortear={sortear} podeEditar={podeEditar} volume={mudo || palco ? 0 : volume} visual={d.visual} chat={d.chat} />
          ))}
        </div>
      ) : (
        <section className="d-card">
          <Vazio>Nenhum sorteio nesta live.</Vazio>
        </section>
      )}
      {palco && <Palco d={d} c={c} giro={giro} sortear={sortear} aoFechar={() => setPalco(false)} podeEditar={podeEditar} volume={volume} mudo={mudo} setMudo={setMudo} />}
    </section>
  );
}
