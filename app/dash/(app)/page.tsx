"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MonitorPlay, Radio } from "lucide-react";
import { haQuanto, inteiro, useAgora, useDash } from "@/lib/dash/cliente";
import type { LiveInfo } from "@/lib/dash/api";
import { Avatar, StatusLive } from "@/components/dash/ui";

// Início, como no Dash TCG: "Sua live" e "Monitorar uma live" (com os termos
// da carpa dourada). Embaixo, as lives de outros vendedores que a extensão
// está vendo agora.

function LinhaLive({ live }: { live: LiveInfo }) {
  const agora = useAgora(10000);
  return (
    <Link href={`/dash/painel/${encodeURIComponent(live.showId)}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-d-panel2">
      <Avatar foto={live.vendedorFoto ?? live.capa} nome={live.vendedor} tamanho={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{live.titulo || "Live"}</p>
        <p className="truncate text-xs text-d-ink3">
          @{live.vendedor} · {live.audiencia != null ? `${inteiro(live.audiencia)} assistindo · ` : ""}dados {haQuanto(live.vistoEm, agora)}
        </p>
      </div>
      <StatusLive aoVivo={live.aoVivo} />
    </Link>
  );
}

export default function Inicio() {
  const { eu, chamar, recarregarEu } = useDash();
  const [link, setLink] = useState("");
  const [aviso, setAviso] = useState("");
  const [termos, setTermos] = useState(eu.config.termosCarpa);
  useEffect(() => setTermos(eu.config.termosCarpa), [eu.config.termosCarpa]);
  const live = eu.live;
  const dono = eu.membro.papel === "dono";

  function monitorar(e: React.FormEvent) {
    e.preventDefault();
    const m = link.trim().match(/^(?:https?:\/\/)?(?:www\.)?jamble\.com\/(?:s|live)\/[^\s]+/i);
    if (!m) return setAviso("Cole um link de live da Jamble (jamble.com/s/… ou jamble.com/live/…).");
    window.open(m[0].startsWith("http") ? m[0] : `https://${m[0]}`, "_blank", "noopener");
    setAviso("A live abriu numa aba nova. Com a extensão Village ligada nesse navegador, ela aparece aqui embaixo em alguns segundos.");
    setLink("");
  }

  async function salvarTermos() {
    if (termos === eu.config.termosCarpa) return;
    await chamar("/api/dash/eu", { metodo: "PATCH", corpo: { termosCarpa: termos } }).catch(() => {});
    recarregarEu();
  }

  return (
    <main className="d-page">
      <header>
        <h1 className="d-page-title">Início</h1>
        <p className="d-page-sub">Cole o link de uma live que esteja no ar e acompanhe emotions, compradores e vendas em tempo real.</p>
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
              <p>Nenhuma live sua no ar agora.</p>
              <p className="text-xs text-d-ink3">Deixe a extensão ligada no Edge: quando a live começar, ela aparece aqui sozinha.</p>
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

      <form className="d-card overflow-hidden" onSubmit={monitorar}>
        <header className="d-card-header justify-between">
          <h2 className="d-card-title">
            <MonitorPlay className="size-4 shrink-0 text-d-brand" />
            <span className="truncate">Monitorar uma live</span>
          </h2>
          <span className="text-xs text-d-ink3">Links jamble.com/s/… e jamble.com/live/…</span>
        </header>
        <div className="d-card-body space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input placeholder="https://www.jamble.com/s/codigo" className="d-field min-w-0 flex-1 px-4 py-2.5 text-base sm:text-sm" value={link} onChange={(e) => setLink(e.target.value)} />
            <button type="submit" className="d-btn d-btn-primary px-6 py-2.5">
              Monitorar
            </button>
          </div>
          {aviso && <p className="text-xs text-d-ink3">{aviso}</p>}
          <label className="block space-y-1.5">
            <span className="d-label">Emojis/termos que contam como magikarp dourado (separados por vírgula)</span>
            <input className="d-field w-full font-mono" value={termos} disabled={!dono} onChange={(e) => setTermos(e.target.value)} onBlur={salvarTermos} />
          </label>
          {eu.outras.length > 0 && (
            <div className="space-y-1 border-t border-d-line pt-3">
              <p className="d-label px-2">Lives que a extensão está vendo agora</p>
              {eu.outras.map((l) => (
                <LinhaLive key={l.showId} live={l} />
              ))}
            </div>
          )}
        </div>
      </form>
    </main>
  );
}
