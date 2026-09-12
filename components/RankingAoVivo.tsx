"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, RefreshCw, Trophy } from "lucide-react";

type Comprador = { handle: string; nome?: string; centavos: number; pedidos: number; ultimo: number };
type Lista = { atualizado: number; top: Comprador[]; titulo?: string | null; inicio?: number; desde?: number };
type Dados = { live: Lista; acumulado: Lista };

const INTERVALO = 15000;

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function desde(quando: number) {
  const seg = Math.max(0, Math.round((Date.now() - quando) / 1000));
  if (seg < 60) return `há ${seg}s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.round(horas / 24)} dias`;
}

const MEDALHAS = ["bg-brand-yellow text-ink", "bg-[#C9CDD4] text-ink", "bg-[#D9A066] text-white"];

function Linha({ pos, c }: { pos: number; c: Comprador }) {
  const podio = pos <= 3;
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        podio ? "border-brand-yellow/50 bg-brand-yellow/5" : "border-card-border bg-white"
      }`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          podio ? MEDALHAS[pos - 1] : "bg-surface text-muted"
        }`}
      >
        {pos}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-ink">@{c.handle}</span>
      <span className="shrink-0 text-right">
        <span className="block font-bold text-ink">{reais(c.centavos)}</span>
        <span className="block text-[10px] text-muted">
          {c.pedidos} {c.pedidos === 1 ? "compra" : "compras"}
        </span>
      </span>
    </li>
  );
}

export default function RankingAoVivo() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [aba, setAba] = useState<"live" | "geral">("live");
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async () => {
    try {
      const r = await fetch("/api/ranking", { cache: "no-store" });
      if (!r.ok) throw new Error("falhou");
      setDados(await r.json());
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
    const t = setInterval(() => {
      // Sem gastar requisição com a aba escondida.
      if (document.visibilityState === "visible") buscar();
    }, INTERVALO);
    return () => clearInterval(t);
  }, [buscar]);

  const lista = dados ? (aba === "live" ? dados.live : dados.acumulado) : null;
  const top = lista?.top ?? [];
  const aoVivo = !!dados && Date.now() - dados.live.atualizado < 3 * 60 * 1000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-card-border bg-white p-1">
          {(["live", "geral"] as const).map((chave) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-colors ${
                aba === chave ? "bg-brand-yellow text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {chave === "live" ? "Live de hoje" : "Geral"}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          {aoVivo && aba === "live" && (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-red" aria-hidden />
          )}
          {carregando ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : lista ? (
            `atualizado ${desde(lista.atualizado)}`
          ) : null}
        </p>
      </div>

      {erro && !dados && (
        <p className="rounded-lg border border-card-border bg-white p-4 text-center">
          Não consegui carregar o ranking agora. Ele volta sozinho em alguns segundos.
        </p>
      )}

      {!carregando && top.length === 0 && (
        <div className="rounded-lg border border-card-border bg-white p-6 text-center">
          <Trophy size={28} className="mx-auto text-brand-yellow" />
          <p className="mt-2 font-bold text-ink">O ranking abre com a live</p>
          <p className="mt-1">
            Cada compra na live entra aqui na hora. Quem gastar mais fica no topo.
          </p>
        </div>
      )}

      {top.length > 0 && (
        <>
          {aba === "live" && dados?.live.titulo && (
            <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-ink">
              <Crown size={14} className="text-brand-yellow" />
              {dados.live.titulo}
            </p>
          )}
          <ol className="space-y-2">
            {top.map((c, i) => (
              <Linha key={c.handle} pos={i + 1} c={c} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
