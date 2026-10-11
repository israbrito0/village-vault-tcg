"use client";

import type { ReactNode } from "react";
import { Volume2, type LucideIcon } from "lucide-react";
import type { Icone } from "@/lib/dash/api";

// Peças das telas do Dash, no mesmo desenho do Dash TCG: cartões com cabeçalho,
// listas com rolagem própria, números grandes e etiquetas redondas.

type IconeLucide = LucideIcon;

export function Cartao({
  titulo,
  icone: I,
  direita,
  children,
  className = "",
  semCorpo = false,
}: {
  titulo?: ReactNode;
  icone?: IconeLucide;
  direita?: ReactNode;
  children?: ReactNode;
  className?: string;
  semCorpo?: boolean;
}) {
  return (
    <section className={`d-card flex min-h-0 flex-col overflow-hidden ${className}`}>
      {(titulo || direita) && (
        <header className="d-card-header justify-between">
          <h2 className="d-card-title">
            {I && <I className="size-4 shrink-0 text-d-brand" />}
            <span className="truncate">{titulo}</span>
          </h2>
          {direita}
        </header>
      )}
      {semCorpo ? children : <div className="d-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>}
    </section>
  );
}

export function Kpi({ rotulo, valor, cor = "", dinheiro = false }: { rotulo: string; valor: ReactNode; cor?: string; dinheiro?: boolean }) {
  return (
    <div className="d-card p-4">
      <p className="text-xs font-medium text-d-ink3">{rotulo}</p>
      {/* O número diminui um pouco em telas médias para "R$ 58.000,00" caber inteiro. */}
      <p className={`mt-1.5 truncate text-[clamp(1.05rem,1.4vw+0.4rem,1.5rem)] font-bold tracking-tight tabular-nums ${cor} ${dinheiro ? "dash-valor" : ""}`}>{valor}</p>
    </div>
  );
}

export function Avatar({ foto, nome, tamanho = 28 }: { foto?: string | null; nome?: string | null; tamanho?: number }) {
  const letra = (nome ?? "?").replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={foto}
      alt=""
      width={tamanho}
      height={tamanho}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full bg-d-panel2 object-cover"
      style={{ width: tamanho, height: tamanho }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-d-panel2 font-semibold text-d-ink2"
      style={{ width: tamanho, height: tamanho, fontSize: Math.max(10, tamanho * 0.42) }}
    >
      {letra}
    </span>
  );
}

export function FiguraEmocao({ id, icones, className = "size-6" }: { id: string; icones: Record<string, Icone>; className?: string }) {
  const url = icones[id]?.url;
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={id} title={id} className={`${className} shrink-0 object-contain`} /> : <span className="font-mono text-[10px] text-d-ink3">{id}</span>;
}

// Etiqueta redonda de emotion, com a figurinha, o código e a contagem.
export function ChipEmocao({
  id,
  icones,
  qtd,
  pts,
  ligado,
  onClick,
  titulo,
}: {
  id: string;
  icones: Record<string, Icone>;
  qtd?: number;
  pts?: number | null;
  ligado: boolean;
  onClick?: () => void;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      title={titulo}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
        ligado ? "border-d-gold bg-d-gold/15 text-d-gold" : "border-d-line bg-d-panel2 text-d-ink2 enabled:hover:border-d-ink3"
      }`}
    >
      <FiguraEmocao id={id} icones={icones} className="size-4" />
      <span className="font-mono">{id}</span>
      {qtd != null && <b className="tabular-nums">{qtd.toLocaleString("pt-BR")}</b>}
      {pts != null && <span className="text-d-ink3">{pts} pts</span>}
    </button>
  );
}

export function StatusLive({ aoVivo, titulo }: { aoVivo: boolean; titulo?: string }) {
  return (
    <span
      title={titulo ?? (aoVivo ? "Live no ar" : "Live encerrada — mostrando o histórico salvo")}
      className="inline-flex items-center gap-2 rounded-full border border-d-line bg-d-panel px-3 py-1 text-xs font-semibold shadow-sm"
    >
      <span className={`size-2 rounded-full ${aoVivo ? "d-pulse bg-d-bad" : "bg-d-ink3"}`} />
      {aoVivo ? "Ao vivo" : "Encerrada"}
    </span>
  );
}

export function Volume({ valor, mudar }: { valor: number; mudar: (v: number) => void }) {
  return (
    <label
      className="flex items-center gap-1.5 rounded-lg border border-d-line bg-d-panel px-2.5 py-1.5 text-xs text-d-ink2 shadow-sm"
      title="Volume dos sons (vendas, pagamentos, sorteios e metas)"
    >
      <Volume2 className="size-4 shrink-0" />
      <input
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={valor}
        onChange={(e) => mudar(Number(e.target.value))}
        className="h-1 w-20 cursor-pointer accent-[rgb(var(--d-gold))]"
        aria-label="Volume dos sons"
      />
      <span className="w-9 text-right tabular-nums">{Math.round(valor * 100)}%</span>
    </label>
  );
}

// Grupo de botões em que só um fica marcado (as escolhas dos formulários).
export function Escolha<T extends string>({ valor, opcoes, mudar, className = "" }: { valor: T; opcoes: [T, string][]; mudar: (v: T) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap rounded-xl border border-d-line p-0.5 ${className}`}>
      {opcoes.map(([v, rotulo]) => (
        <button
          key={v}
          type="button"
          onClick={() => mudar(v)}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${v === valor ? "bg-d-brand font-semibold text-d-on-brand" : "text-d-ink2 hover:bg-d-panel2"}`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-center text-sm text-d-ink3">{children}</p>;
}

export function Barra({ progresso, cor = "bg-d-gold" }: { progresso: number; cor?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-d-panel2">
      <div className={`h-full rounded-full ${cor} transition-[width] duration-700`} style={{ width: `${Math.round(Math.max(0, Math.min(1, progresso)) * 100)}%` }} />
    </div>
  );
}
