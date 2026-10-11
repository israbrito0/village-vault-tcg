"use client";

import type { ReactNode } from "react";
import type { Icone } from "@/lib/dash/api";

// Peças das telas do Dash (tema escuro, para usar à noite durante a live).

export function Cartao({
  titulo,
  acao,
  children,
  className = "",
  semPadding = false,
}: {
  titulo?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-white/[0.08] bg-[#171a21] ${className}`}>
      {(titulo || acao) && (
        <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <h2 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b93a7]">{titulo}</h2>
          {acao}
        </header>
      )}
      <div className={semPadding ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Kpi({ rotulo, valor, detalhe, cor = "text-white", dinheiro = false }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; cor?: string; dinheiro?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#171a21] px-4 py-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b93a7]">{rotulo}</p>
      <p className={`mt-1 truncate font-display text-2xl font-extrabold ${cor} ${dinheiro ? "dash-valor" : ""}`}>{valor}</p>
      {detalhe && <p className={`mt-0.5 truncate text-[11px] text-[#8b93a7] ${dinheiro ? "dash-valor" : ""}`}>{detalhe}</p>}
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
      className="shrink-0 rounded-full bg-white/10 object-cover"
      style={{ width: tamanho, height: tamanho }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-white/70"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42 }}
    >
      {letra}
    </span>
  );
}

export function IconeEmocao({ id, icones, tamanho = 22 }: { id: string; icones: Record<string, Icone>; tamanho?: number }) {
  const i = icones[id];
  if (i?.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={i.url} alt={i.nome ?? id} title={i.nome ?? id} width={tamanho} height={tamanho} className="shrink-0 object-contain" style={{ width: tamanho, height: tamanho }} />;
  }
  return <span className="shrink-0 rounded bg-white/10 px-1 text-[10px] text-white/70">{id}</span>;
}

export function Botao({
  children,
  onClick,
  cor = "neutro",
  ativo = false,
  disabled = false,
  titulo,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  cor?: "neutro" | "amarelo" | "verde" | "vermelho" | "azul";
  ativo?: boolean;
  disabled?: boolean;
  titulo?: string;
  className?: string;
  type?: "button" | "submit";
}) {
  const cores = {
    neutro: ativo ? "border-white/30 bg-white/15 text-white" : "border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/10",
    amarelo: "border-brand-yellow bg-brand-yellow text-ink hover:brightness-110",
    verde: "border-brand-green bg-brand-green text-white hover:brightness-110",
    vermelho: ativo ? "border-brand-red bg-brand-red text-white" : "border-brand-red/40 bg-brand-red/10 text-[#ff8a8a] hover:bg-brand-red/20",
    azul: "border-brand-blue bg-brand-blue text-white hover:brightness-110",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${cores[cor]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Selo({ children, cor = "neutro" }: { children: ReactNode; cor?: "neutro" | "vermelho" | "verde" | "amarelo" | "azul" }) {
  const cores = {
    neutro: "bg-white/10 text-white/70",
    vermelho: "bg-brand-red/15 text-[#ff8a8a]",
    verde: "bg-brand-green/15 text-[#6fdc94]",
    amarelo: "bg-brand-yellow/15 text-brand-yellow",
    azul: "bg-brand-blue/15 text-[#7cc7f0]",
  };
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cores[cor]}`}>{children}</span>;
}

export function AoVivo({ aoVivo }: { aoVivo: boolean }) {
  return aoVivo ? (
    <Selo cor="vermelho">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-red" />
      AO VIVO
    </Selo>
  ) : (
    <Selo>encerrada</Selo>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-[12px] text-[#8b93a7]">{children}</p>;
}

export function Barra({ progresso, cor = "bg-brand-yellow" }: { progresso: number; cor?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${cor} transition-[width] duration-700`} style={{ width: `${Math.round(Math.max(0, Math.min(1, progresso)) * 100)}%` }} />
    </div>
  );
}

// Lista com rolagem própria (o painel tem muitas, lado a lado).
export function Rolagem({ children, altura = "max-h-80" }: { children: ReactNode; altura?: string }) {
  return <div className={`${altura} overflow-y-auto overscroll-contain pr-1`}>{children}</div>;
}

export const campo =
  "w-full rounded-lg border border-white/10 bg-[#0f1116] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-brand-yellow/60 focus:outline-none";
