"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarDays, Lock, LogOut, Receipt, TrendingUp, Trophy } from "lucide-react";
import type { Metricas } from "@/lib/metricas";
import type { Comprador } from "@/lib/ranking";

const CHAVE_LOCAL = "vv-metricas-chave";
const INTERVALO = 10000;

function reais(centavos: number, curto = false) {
  const v = centavos / 100;
  if (curto && v >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(dia: string) {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

function Cartao({
  titulo,
  icone,
  destaque,
  linhas,
  selo,
}: {
  titulo: string;
  icone: React.ReactNode;
  destaque: string;
  linhas: [string, string][];
  selo?: string;
}) {
  return (
    <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {icone}
        {titulo}
        {selo && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold text-brand-red">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-red" />
            {selo}
          </span>
        )}
      </p>
      <p className="mt-1.5 font-display text-2xl font-extrabold text-ink">{destaque}</p>
      <dl className="mt-2 space-y-1">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between gap-3 text-[12px]">
            <dt className="text-muted">{rotulo}</dt>
            <dd className="font-medium text-ink">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Barras({ dados, rotulo }: { dados: { chave: string; valor: number }[]; rotulo: string }) {
  const maior = Math.max(1, ...dados.map((d) => d.valor));
  const total = dados.reduce((t, d) => t + d.valor, 0);
  if (total === 0) return null;
  return (
    <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{rotulo}</p>
      <div className="mt-3 flex h-24 items-end gap-[3px]">
        {dados.map((d) => (
          <div
            key={d.chave}
            title={`${d.chave}: ${reais(d.valor)}`}
            className="flex-1 rounded-t bg-brand-yellow/80"
            style={{ height: `${Math.max(2, (d.valor / maior) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{dados[0]?.chave}</span>
        <span>{dados[dados.length - 1]?.chave}</span>
      </div>
    </section>
  );
}

function TopCompradores({ live, geral }: { live: Comprador[]; geral: Comprador[] }) {
  const [aba, setAba] = useState<"live" | "geral">("live");
  const lista = aba === "live" ? live : geral;
  return (
    <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          <Trophy size={14} />
          Top compradores
        </p>
        <div className="inline-flex rounded-full border border-card-border p-0.5">
          {(["live", "geral"] as const).map((chave) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                aba === chave ? "bg-brand-yellow text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {chave === "live" ? "Live" : "Geral"}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="mt-3 text-[12px] text-muted">Ninguém comprou ainda.</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {lista.map((c, i) => (
            <li key={c.handle} className="flex items-center gap-2 text-[12px]">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  i < 3 ? "bg-brand-yellow text-ink" : "bg-surface text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-ink">@{c.handle}</span>
              <span className="shrink-0 text-muted">
                {c.pedidos}x · {reais(Math.round(c.centavos / c.pedidos))}
              </span>
              <span className="w-24 shrink-0 text-right font-bold text-ink">{reais(c.centavos)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[10px] text-muted">Pedidos e ticket médio de cada um, e o total gasto.</p>
    </section>
  );
}

export default function PainelMetricas() {
  const [chave, setChave] = useState<string | null>(null);
  const [digitada, setDigitada] = useState("");
  const [dados, setDados] = useState<Metricas | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    try {
      setChave(localStorage.getItem(CHAVE_LOCAL));
    } catch {
      setChave(null);
    }
  }, []);

  const buscar = useCallback(async (usar: string) => {
    try {
      const r = await fetch("/api/metricas", {
        cache: "no-store",
        headers: { authorization: `Bearer ${usar}` },
      });
      if (r.status === 401) {
        setErro("Chave inválida.");
        setDados(null);
        return false;
      }
      if (!r.ok) throw new Error("falhou");
      setDados(await r.json());
      setErro("");
      return true;
    } catch {
      setErro("Não consegui carregar agora.");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!chave) return;
    buscar(chave);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") buscar(chave);
    }, INTERVALO);
    return () => clearInterval(t);
  }, [chave, buscar]);

  if (!chave) {
    return (
      <form
        className="mx-auto max-w-sm space-y-3 rounded-xl border border-card-border bg-white p-5 text-center shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
        onSubmit={async (e) => {
          e.preventDefault();
          const valor = digitada.trim();
          if (!valor) return;
          if (await buscar(valor)) {
            try {
              localStorage.setItem(CHAVE_LOCAL, valor);
            } catch {}
            setChave(valor);
          }
        }}
      >
        <Lock size={22} className="mx-auto text-brand-blue" />
        <p className="font-bold text-ink">Página privada</p>
        <p className="text-[12px] text-muted">Cole a chave de métricas para ver os números.</p>
        <input
          type="password"
          value={digitada}
          onChange={(e) => setDigitada(e.target.value)}
          placeholder="chave"
          className="w-full rounded-lg border border-card-border px-3 py-2 text-center"
        />
        {erro && <p className="text-[12px] text-brand-red">{erro}</p>}
        <button type="submit" className="w-full rounded-full bg-brand-yellow px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-ink">
          Entrar
        </button>
      </form>
    );
  }

  if (!dados) {
    return (
      <p className="rounded-xl border border-card-border bg-white p-5 text-center">
        {erro || "Carregando os números…"}
      </p>
    );
  }

  const { live, mes, total } = dados;
  const variacao =
    mes.mesAnteriorCentavos > 0
      ? Math.round(((mes.centavos - mes.mesAnteriorCentavos) / mes.mesAnteriorCentavos) * 100)
      : null;

  return (
    <div className="space-y-3">
      <Cartao
        titulo="Faturamento da live"
        icone={<Activity size={14} />}
        selo={live.emAndamento ? "ao vivo" : undefined}
        destaque={reais(live.centavos)}
        linhas={[
          ["Pedidos", String(live.pedidos)],
          ["Compradores", String(live.compradores)],
          ["Ticket médio", reais(live.ticketCentavos)],
          ["Na última hora", reais(live.porHoraCentavos)],
          ["Live", live.titulo || live.id || "—"],
        ]}
      />

      <Barras
        rotulo="Faturamento por minuto (últimas 2h de live)"
        dados={live.minutos.map((m) => ({
          chave: new Date(m.minuto * 60000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          valor: m.centavos,
        }))}
      />

      <TopCompradores live={dados.topLive} geral={dados.topGeral} />

      <Cartao
        titulo={`Mês ${mes.rotulo}`}
        icone={<CalendarDays size={14} />}
        destaque={reais(mes.centavos)}
        linhas={[
          ["Projeção do mês", reais(mes.projecaoCentavos)],
          ["Média por dia", reais(mes.mediaDiariaCentavos)],
          ["Dia do mês", `${mes.diaAtual} de ${mes.diasNoMes}`],
          ["Dias com venda", String(mes.diasComVenda)],
          ["Ticket médio no mês", reais(mes.ticketCentavos)],
          [
            "Mês anterior",
            mes.mesAnteriorCentavos
              ? `${reais(mes.mesAnteriorCentavos)}${variacao !== null ? ` (${variacao >= 0 ? "+" : ""}${variacao}%)` : ""}`
              : "sem dados",
          ],
        ]}
      />

      <Cartao
        titulo="Faturamento total"
        icone={<TrendingUp size={14} />}
        destaque={reais(total.centavos)}
        linhas={[
          ["Pedidos", String(total.pedidos)],
          ["Compradores diferentes", String(total.compradores)],
          ["Ticket médio geral", reais(total.ticketCentavos)],
          ["Contando desde", new Date(total.desde).toLocaleDateString("pt-BR")],
        ]}
      />

      <Barras
        rotulo="Faturamento por dia (30 dias)"
        dados={dados.dias.map((d) => ({ chave: dataCurta(d.dia), valor: d.centavos }))}
      />

      <p className="flex items-center justify-between gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <Receipt size={12} />
          Só as vendas capturadas nas lives da Jamble.
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-medium text-brand-blue"
          onClick={() => {
            try {
              localStorage.removeItem(CHAVE_LOCAL);
            } catch {}
            setChave(null);
            setDados(null);
          }}
        >
          <LogOut size={12} />
          Sair
        </button>
      </p>
    </div>
  );
}
