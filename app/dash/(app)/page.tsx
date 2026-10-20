"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Copy, Download, Loader2, MonitorPlay, Puzzle, Radio } from "lucide-react";
import { copiar, dataHora, haQuanto, inteiro, useAgora, useDash } from "@/lib/dash/cliente";
import type { LiveInfo, MonitorInfo } from "@/lib/dash/api";
import { Avatar, StatusLive } from "@/components/dash/ui";

// Início, como no Dash TCG: "Sua live" e "Monitorar uma live" (com os termos
// da carpa dourada). Colar o link liga o robô (no servidor, sem a extensão)
// e abre o painel da live. Embaixo, as lives que o robô e a extensão estão
// acompanhando.

type RespostaMonitor = { monitores: MonitorInfo[]; robo: { rodouEm: number | null; terminouEm: number | null; erro: string | null } };

function LinhaLive({ live, monitor, onParar, onReligar }: { live?: LiveInfo; monitor?: MonitorInfo; onParar?: () => void; onReligar?: () => void }) {
  const agora = useAgora(10000);
  const showId = live?.showId ?? monitor!.showId;
  const vendedor = live?.vendedor ?? monitor?.vendedor;
  const ligado = monitor?.ativo === true;
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-d-panel2">
      <Link href={`/dash/painel/${encodeURIComponent(showId)}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar foto={live?.vendedorFoto ?? live?.capa ?? null} nome={vendedor ?? "?"} tamanho={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{live?.titulo || monitor?.titulo || "Live"}</p>
          <p className="truncate text-xs text-d-ink3">
            {live?.aoVivo && <span className="font-semibold text-d-bad sm:hidden">ao vivo · </span>}
            {vendedor ? `@${vendedor} · ` : ""}
            {live?.audiencia != null && live.aoVivo ? `${inteiro(live.audiencia)} assistindo · ` : ""}
            {monitor
              ? ligado
                ? monitor.comecaEm && monitor.comecaEm > agora
                  ? `robô espera a live (${dataHora(monitor.comecaEm)})`
                  : monitor.ultimoCiclo
                  ? `robô leu ${haQuanto(monitor.ultimoCiclo, agora)}`
                  : "robô entrando na live…"
                : "robô parado"
              : `extensão ${haQuanto(live?.vistoEm, agora)}`}
            {monitor?.ultimoErro ? ` · erro: ${monitor.ultimoErro}` : ""}
          </p>
        </div>
      </Link>
      {/* No celular o selo não cabe ao lado do título: "ao vivo" vai na linha de baixo. */}
      {live && (
        <span className="hidden sm:block">
          <StatusLive aoVivo={live.aoVivo} />
        </span>
      )}
      {monitor &&
        (ligado ? (
          <button type="button" className="d-btn d-btn-sm d-btn-ghost" onClick={onParar} title="O robô para de acompanhar esta live">
            Parar
          </button>
        ) : (
          <button type="button" className="d-btn d-btn-sm d-btn-secondary" onClick={onReligar} title="O robô volta a acompanhar esta live">
            Retomar
          </button>
        ))}
    </div>
  );
}

// A extensão do Edge: desde 19/10/2026 a Jamble barra robôs, e o que grava a
// live é a extensão de cada vendedor, com a live aberta no navegador dele. A
// chave diz ao Dash de qual conta ela é.
function CartaoExtensao({ chave, vistaEm }: { chave: string | null; vistaEm: number | null }) {
  const agora = useAgora(10000);
  const [copiada, setCopiada] = useState(false);
  const ligada = !!vistaEm && agora - vistaEm < 3 * 60e3;
  return (
    <section className="d-card overflow-hidden">
      <header className="d-card-header justify-between">
        <h2 className="d-card-title">
          <Puzzle className="size-4 shrink-0 text-d-brand" />
          <span className="truncate">Extensão do Edge</span>
        </h2>
        <span className={`text-xs ${ligada ? "text-d-ok" : "text-d-ink3"}`}>
          {ligada ? `ligada · mandou dados ${haQuanto(vistaEm, agora)}` : vistaEm ? `sem sinal ${haQuanto(vistaEm, agora)}` : "ainda não usada"}
        </span>
      </header>
      <div className="d-card-body space-y-3 text-sm">
        <p className="text-d-ink2">
          A Jamble passou a barrar robôs: quem grava a sua live (vendas, diamantes e chat) é a extensão, com a live aberta no seu Edge.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-d-ink2">
          <li>
            <a href="/extensao/village-assistente.zip" className="inline-flex items-center gap-1 font-semibold text-d-brand hover:underline" download>
              <Download className="size-3.5" />
              Baixe a extensão
            </a>{" "}
            e descompacte.
          </li>
          <li>
            No Edge, abra <span className="font-mono text-xs">edge://extensions</span>, ligue o <b>Modo de desenvolvedor</b> e clique em <b>Carregar sem compactação</b> (escolha a pasta).
          </li>
          <li>
            Clique no ícone da extensão e cole a chave abaixo em <b>Senha de envio</b>.
          </li>
          <li>Na hora da live, deixe a página da sua live aberta no Edge. O Dash recebe tudo a cada poucos segundos.</li>
        </ol>
        {chave && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="d-field min-w-0 flex-1 px-3 py-2 font-mono text-xs" readOnly value={chave} onFocus={(e) => e.currentTarget.select()} aria-label="Chave da extensão" />
            <button
              type="button"
              className="d-btn d-btn-secondary"
              onClick={async () => {
                await copiar(chave);
                setCopiada(true);
                setTimeout(() => setCopiada(false), 1500);
              }}
            >
              <Copy className="size-4" />
              {copiada ? "Copiada" : "Copiar chave"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Inicio() {
  const { eu, chamar, recarregarEu } = useDash();
  const router = useRouter();
  const agora = useAgora(10000);
  const [link, setLink] = useState("");
  const [aviso, setAviso] = useState("");
  const [indo, setIndo] = useState(false);
  const [mon, setMon] = useState<RespostaMonitor | null>(null);
  const [termos, setTermos] = useState(eu.config.termosCarpa);
  useEffect(() => setTermos(eu.config.termosCarpa), [eu.config.termosCarpa]);
  const live = eu.live;
  const dono = eu.membro.papel === "dono";
  const agendada = eu.robo?.agendada ?? null;

  // Como no Dash TCG: com esta página aberta, o Painel abre sozinho quando a
  // live começa (a conta é conferida a cada 30 s enquanto não há live no ar).
  const aoVivo = !!live?.aoVivo;
  const estavaNoAr = useRef(aoVivo);
  useEffect(() => {
    if (aoVivo && !estavaNoAr.current && live) router.push(`/dash/painel/${encodeURIComponent(live.showId)}`);
    estavaNoAr.current = aoVivo;
  }, [aoVivo, live, router]);
  useEffect(() => {
    if (aoVivo) return;
    const t = setInterval(recarregarEu, 30000);
    return () => clearInterval(t);
  }, [aoVivo, recarregarEu]);

  const lerMonitores = useCallback(() => {
    chamar<RespostaMonitor>("/api/dash/monitor")
      .then(setMon)
      .catch(() => {});
  }, [chamar]);
  useEffect(() => {
    lerMonitores();
    const t = setInterval(lerMonitores, 15000);
    return () => clearInterval(t);
  }, [lerMonitores]);

  async function monitorar(e: React.FormEvent) {
    e.preventDefault();
    if (!link.trim() || indo) return;
    setIndo(true);
    setAviso("Procurando a live na Jamble…");
    try {
      const r = await chamar<{ showId: string; acabou: boolean; comecou: boolean }>("/api/dash/monitor", { corpo: { link } });
      setLink("");
      recarregarEu();
      lerMonitores();
      if (!r.comecou && !r.acabou) {
        // Live agendada: fica na lista, e o robô entra sozinho quando começar.
        setAviso("Essa live ainda não começou. O robô entra nela sozinho 10 minutos antes do horário — ela aparece na lista abaixo.");
        return;
      }
      setAviso(r.acabou ? "Essa live já acabou: o robô puxa os vendidos dela e para." : "Robô ligado. Abrindo o painel…");
      router.push(`/dash/painel/${encodeURIComponent(r.showId)}`);
    } catch (erro) {
      setAviso((erro as Error).message);
    } finally {
      setIndo(false);
    }
  }

  async function mudar(m: MonitorInfo, ativo: boolean) {
    await chamar("/api/dash/monitor", { metodo: "PATCH", corpo: { id: m.id, ativo } }).catch(() => {});
    lerMonitores();
    recarregarEu();
  }

  async function salvarTermos() {
    if (termos === eu.config.termosCarpa) return;
    await chamar("/api/dash/eu", { metodo: "PATCH", corpo: { termosCarpa: termos } }).catch(() => {});
    recarregarEu();
  }

  // As lives da lista: as do robô primeiro, depois as que só a extensão vê.
  const monitores = (mon?.monitores ?? []).filter((m) => m.showId !== live?.showId || !m.automatico);
  const doRobo = new Set(monitores.map((m) => m.showId));
  const daExtensao = eu.outras.filter((l) => !doRobo.has(l.showId));
  const porId = new Map(eu.outras.map((l) => [l.showId, l]));
  if (live) porId.set(live.showId, live);
  const roboRodando = !!mon?.robo.rodouEm && agora - mon.robo.rodouEm < 3 * 60e3;

  return (
    <main className="d-page">
      <header>
        <h1 className="d-page-title">Início</h1>
        <p className="d-page-sub">Cole o link de uma live que esteja no ar e acompanhe diamantes, compradores e vendas em tempo real.</p>
      </header>

      <section className="d-card overflow-hidden">
        <header className="d-card-header justify-between">
          <h2 className="d-card-title">
            <Radio className="size-4 shrink-0 text-d-brand" />
            <span className="truncate">Sua live</span>
          </h2>
          <span className="text-xs text-d-ink3">
            @{eu.membro.conta} · {live?.aoVivo ? "ao vivo" : "fora do ar"}
          </span>
        </header>
        <div className="d-card-body space-y-1 text-sm">
          {live?.aoVivo ? (
            <div className="flex flex-wrap items-center gap-3">
              <Avatar foto={live.vendedorFoto ?? live.capa} nome={live.vendedor} tamanho={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{live.titulo}</p>
                <p className="text-xs text-d-ink3">{live.audiencia != null ? `${inteiro(live.audiencia)} assistindo agora` : "No ar agora"}</p>
              </div>
              <Link href={`/dash/painel/${encodeURIComponent(live.showId)}`} className="d-btn d-btn-primary">
                Abrir painel
              </Link>
            </div>
          ) : (
            <>
              {agendada ? (
                <div className="flex items-center gap-3 pb-1">
                  <Avatar foto={agendada.capa} nome={agendada.titulo ?? "Live"} tamanho={40} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">Próxima live: {agendada.titulo || "sem título"}</p>
                    <p className="text-xs text-d-ink3">{agendada.inicio ? `agendada para ${dataHora(agendada.inicio)}` : "agendada na Jamble"}</p>
                  </div>
                </div>
              ) : (
                <p>Nenhuma live agendada na Jamble.</p>
              )}
              <p className="text-xs text-d-ink3">Deixe esta página aberta: quando a live começar (com a extensão ligada no Edge), o Painel abre sozinho.</p>
              {live && (
                <p className="pt-2 text-xs">
                  Última:{" "}
                  <Link className="font-semibold text-d-brand hover:underline" href={`/dash/painel/${encodeURIComponent(live.showId)}`}>
                    {live.titulo}
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <CartaoExtensao chave={eu.extensaoChave} vistaEm={eu.extensaoVistaEm} />

      <form className="d-card overflow-hidden" onSubmit={monitorar}>
        <header className="d-card-header justify-between">
          <h2 className="d-card-title">
            <MonitorPlay className="size-4 shrink-0 text-d-brand" />
            <span className="truncate">Monitorar uma live</span>
          </h2>
          <span className="text-xs text-d-ink3">Links jamble.com/s/…, jamble.com/live/… ou @vendedor</span>
        </header>
        <div className="d-card-body space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              placeholder="https://www.jamble.com/s/codigo"
              className="d-field min-w-0 flex-1 px-4 py-2.5 text-base sm:text-sm"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={indo}
            />
            <button type="submit" className="d-btn d-btn-primary px-6 py-2.5" disabled={indo || !link.trim()}>
              {indo && <Loader2 className="size-4 animate-spin" />}
              Monitorar
            </button>
          </div>
          {aviso && <p className="text-xs text-d-ink3">{aviso}</p>}
          <label className="block space-y-1.5">
            <span className="d-label">Emojis/termos que contam como magikarp dourado (separados por vírgula)</span>
            <input className="d-field w-full font-mono" value={termos} disabled={!dono} onChange={(e) => setTermos(e.target.value)} onBlur={salvarTermos} />
          </label>
          {(monitores.length > 0 || daExtensao.length > 0) && (
            <div className="space-y-1 border-t border-d-line pt-3">
              <div className="flex items-center justify-between gap-2 px-2">
                <p className="d-label">Lives acompanhadas</p>
                <span className={`flex items-center gap-1.5 text-xs ${roboRodando ? "text-d-ok" : "text-d-ink3"}`}>
                  <Bot className="size-3.5" />
                  {roboRodando ? "robô rodando" : mon?.robo.rodouEm ? `robô parado ${haQuanto(mon.robo.rodouEm, agora)}` : "robô sem sinal"}
                </span>
              </div>
              {monitores.map((m) => (
                <LinhaLive key={m.id} monitor={m} live={porId.get(m.showId)} onParar={() => mudar(m, false)} onReligar={() => mudar(m, true)} />
              ))}
              {daExtensao.map((l) => (
                <LinhaLive key={l.showId} live={l} />
              ))}
            </div>
          )}
        </div>
      </form>
    </main>
  );
}
