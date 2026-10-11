"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, ExternalLink, Gift, Radio, RefreshCw, Tv } from "lucide-react";
import { copiar, haQuanto, inteiro, linkDaTela, reais, useAgora, useDash } from "@/lib/dash/cliente";
import type { LiveInfo } from "@/lib/dash/api";
import { AoVivo, Botao, Cartao, campo, Selo } from "@/components/dash/ui";

// Início: a sua live, as de outros vendedores que a extensão está vendo, o
// link para acompanhar outra live, os termos da carpa dourada e as telas do OBS.

function CartaoLive({ live, principal = false }: { live: LiveInfo; principal?: boolean }) {
  const agora = useAgora(5000);
  const m = live.metricas ?? {};
  const fat = Number(m.faturamento) || 0;
  return (
    <div className={`rounded-xl border p-4 ${principal ? "border-brand-yellow/30 bg-brand-yellow/[0.04]" : "border-white/[0.08] bg-[#171a21]"}`}>
      <div className="flex items-start gap-3">
        {live.capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={live.capa} alt="" className="h-16 w-12 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AoVivo aoVivo={live.aoVivo} />
            <span className="text-[11px] text-[#8b93a7]">@{live.vendedor ?? "?"}</span>
            <span className="text-[11px] text-[#8b93a7]">· dados {haQuanto(live.vistoEm, agora)}</span>
          </div>
          <p className="mt-1 truncate font-semibold text-white">{live.titulo || "Live sem título"}</p>
          <p className="mt-0.5 text-[12px] text-[#8b93a7]">
            {live.audiencia != null && <>👀 {inteiro(live.audiencia)} · </>}
            {live.likes != null && <>❤️ {inteiro(live.likes)} · </>}
            <span className="dash-valor">{reais(fat)}</span> vendidos
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/dash/painel/${encodeURIComponent(live.showId)}`}>
          <Botao cor={principal ? "amarelo" : "neutro"}>
            <Radio size={14} /> Abrir painel
          </Botao>
        </Link>
        <Link href={`/dash/sorteios/${encodeURIComponent(live.showId)}`}>
          <Botao>
            <Gift size={14} /> Sorteios & metas
          </Botao>
        </Link>
      </div>
    </div>
  );
}

export default function Inicio() {
  const { eu, chamar, recarregarEu } = useDash();
  const agora = useAgora(5000);
  const [link, setLink] = useState("");
  const [aviso, setAviso] = useState("");
  const [termos, setTermos] = useState(eu.config.termosCarpa);
  const [salvo, setSalvo] = useState("");
  const [copiado, setCopiado] = useState("");

  const sinal = eu.extensaoVistaEm;
  const extensaoViva = !!sinal && agora - sinal < 3 * 60 * 1000;
  const dono = eu.membro.papel === "dono";

  function monitorar(e: React.FormEvent) {
    e.preventDefault();
    const m = link.trim().match(/^(?:https?:\/\/)?(?:www\.)?jamble\.com\/[^\s]+/i);
    if (!m) return setAviso("Cole o link de uma live da Jamble (jamble.com/...).");
    window.open(m[0].startsWith("http") ? m[0] : `https://${m[0]}`, "_blank", "noopener");
    setAviso("Abri a live numa aba nova. Com a extensão ligada nesse navegador, ela aparece aqui em alguns segundos.");
    setLink("");
  }

  async function salvarTermos() {
    try {
      await chamar("/api/dash/eu", { metodo: "PATCH", corpo: { termosCarpa: termos } });
      setSalvo("Salvo!");
      recarregarEu();
    } catch (e) {
      setSalvo(String((e as Error).message));
    }
    setTimeout(() => setSalvo(""), 2500);
  }

  async function novaChave() {
    if (!confirm("Gerar outro link? Os links antigos das telas do OBS param de funcionar.")) return;
    await chamar("/api/dash/eu", { metodo: "PATCH", corpo: { novaChave: true } });
    recarregarEu();
  }

  async function copiarTela(rotulo: string, extra: Record<string, string>) {
    await copiar(linkDaTela(eu.config.telaChave, extra));
    setCopiado(rotulo);
    setTimeout(() => setCopiado(""), 2000);
  }

  const telas: { rotulo: string; extra: Record<string, string> }[] = [
    { rotulo: "Sorteio 16:9", extra: { v: "sorteio", f: "16x9" } },
    { rotulo: "Sorteio 9:16", extra: { v: "sorteio", f: "9x16" } },
    { rotulo: "Metas", extra: { v: "metas", f: "16x9" } },
    { rotulo: "Ranking de carpas", extra: { v: "carpas", f: "9x16" } },
    { rotulo: "Tela geral", extra: { v: "geral", f: "16x9" } },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <Cartao
          titulo="Sua live"
          acao={
            <span className="flex items-center gap-2 text-[11px]">
              <span className={`inline-block h-2 w-2 rounded-full ${extensaoViva ? "bg-brand-green" : "bg-white/30"}`} />
              <span className="text-[#8b93a7]">extensão {sinal ? `mandou dados ${haQuanto(sinal, agora)}` : "ainda não mandou nada"}</span>
            </span>
          }
        >
          {eu.live ? (
            <CartaoLive live={eu.live} principal />
          ) : (
            <p className="text-[13px] text-[#8b93a7]">
              Nenhuma live sua chegou ainda. Abra a sua live (ou o painel do vendedor) da Jamble no Edge com a extensão Village ligada: ela manda tudo
              para cá sozinha.
            </p>
          )}
        </Cartao>

        <Cartao titulo="Outras lives que a extensão está vendo">
          {eu.outras.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {eu.outras.map((l) => (
                <CartaoLive key={l.showId} live={l} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8b93a7]">Nenhuma nas últimas 12 horas.</p>
          )}
          <form onSubmit={monitorar} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input className={campo} placeholder="Acompanhar uma live: cole o link da Jamble" value={link} onChange={(e) => setLink(e.target.value)} />
            <Botao type="submit" cor="azul">
              <ExternalLink size={14} /> Abrir e acompanhar
            </Botao>
          </form>
          {aviso && <p className="mt-2 text-[12px] text-[#8b93a7]">{aviso}</p>}
        </Cartao>
      </div>

      <div className="min-w-0 space-y-4">
        {eu.ranking && (
          <Cartao titulo={`Ranking mensal · ${eu.ranking.mes}`}>
            <p className="font-display text-3xl font-extrabold text-brand-yellow">{eu.ranking.posicao ? `#${eu.ranking.posicao}` : "fora do top"}</p>
            <p className="text-[12px] text-[#8b93a7]">
              {eu.ranking.pontos != null && <>{inteiro(eu.ranking.pontos)} pontos · </>}
              lido {haQuanto(eu.ranking.ts, agora)}
            </p>
            {eu.ranking.acima && eu.ranking.pontos != null && (
              <p className="mt-2 text-[12px] text-white/80">
                Faltam <b>{inteiro(eu.ranking.acima.pontos - eu.ranking.pontos)}</b> pts para passar @{eu.ranking.acima.handle} (#{eu.ranking.acima.posicao})
              </p>
            )}
          </Cartao>
        )}

        <Cartao titulo="Termos da carpa dourada">
          <p className="mb-2 text-[12px] text-[#8b93a7]">
            O que conta como carpa: o código da emotion (magikarp_shiny) e, se quiser, um texto ou emoji que o público manda no chat. Separe com vírgula.
          </p>
          <textarea className={`${campo} h-20 resize-none`} value={termos} onChange={(e) => setTermos(e.target.value)} disabled={!dono} />
          <div className="mt-2 flex items-center gap-2">
            <Botao cor="amarelo" onClick={salvarTermos} disabled={!dono || termos === eu.config.termosCarpa}>
              Salvar
            </Botao>
            {salvo && <span className="text-[12px] text-[#8b93a7]">{salvo}</span>}
          </div>
        </Cartao>

        <Cartao
          titulo="Telas para o OBS"
          acao={
            dono && (
              <button onClick={novaChave} title="Gerar outro link" className="text-white/40 hover:text-white">
                <RefreshCw size={14} />
              </button>
            )
          }
        >
          <p className="mb-3 text-[12px] text-[#8b93a7]">
            No OBS: Fonte → Navegador → cole o link. Abre sem login e sempre mostra a sua live do momento.
          </p>
          <div className="space-y-2">
            {telas.map((t) => (
              <div key={t.rotulo} className="flex items-center gap-2">
                <Tv size={14} className="shrink-0 text-white/40" />
                <span className="flex-1 truncate text-[13px]">{t.rotulo}</span>
                <a href={linkDaTela(eu.config.telaChave, t.extra)} target="_blank" rel="noreferrer" className="text-[11px] text-white/50 hover:text-white">
                  ver
                </a>
                <Botao onClick={() => copiarTela(t.rotulo, t.extra)}>
                  <Copy size={12} /> {copiado === t.rotulo ? "Copiado!" : "Copiar"}
                </Botao>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#8b93a7]">
            Fundo transparente: acrescente <code className="text-white/70">&amp;fundo=transparente</code> no fim do link.
          </p>
        </Cartao>

        <Cartao titulo="Quem entra">
          <p className="text-[12px] text-[#8b93a7]">
            Você está como <Selo cor="amarelo">{eu.membro.papel}</Selo> com {eu.membro.email}.
          </p>
        </Cartao>
      </div>
    </div>
  );
}
