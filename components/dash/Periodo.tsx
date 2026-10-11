"use client";

import { useMemo, useState } from "react";
import { Botao } from "@/components/dash/ui";

// Filtro de período das páginas de Lives e Clientes (no horário do aparelho).

export type Periodo = { de: number; ate: number; rotulo: string };

const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function calcular(id: string, de: string, ate: string): Periodo {
  const hoje = new Date();
  const amanha = dia(hoje) + 86400000;
  if (id === "hoje") return { de: dia(hoje), ate: amanha, rotulo: "hoje" };
  if (id === "7d") return { de: amanha - 7 * 86400000, ate: amanha, rotulo: "últimos 7 dias" };
  if (id === "30d") return { de: amanha - 30 * 86400000, ate: amanha, rotulo: "últimos 30 dias" };
  if (id === "mes") return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime(), ate: amanha, rotulo: "este mês" };
  if (id === "passado") {
    return {
      de: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).getTime(),
      ate: new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime(),
      rotulo: "mês passado",
    };
  }
  if (id === "outro" && de) {
    const [a, m, d] = de.split("-").map(Number);
    const fim = ate ? ate.split("-").map(Number) : null;
    return {
      de: new Date(a, m - 1, d).getTime(),
      ate: fim ? new Date(fim[0], fim[1] - 1, fim[2]).getTime() + 86400000 : amanha,
      rotulo: `${de.split("-").reverse().join("/")} a ${ate ? ate.split("-").reverse().join("/") : "hoje"}`,
    };
  }
  return { de: 0, ate: amanha, rotulo: "tudo" };
}

export function usePeriodo(inicial = "30d") {
  const [id, setId] = useState(inicial);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const periodo = useMemo(() => calcular(id, de, ate), [id, de, ate]);
  const seletor = (
    <div className="dash-sem-impressao flex flex-wrap items-center gap-1.5">
      {[
        ["hoje", "Hoje"],
        ["7d", "7 dias"],
        ["30d", "30 dias"],
        ["mes", "Este mês"],
        ["passado", "Mês passado"],
        ["tudo", "Tudo"],
        ["outro", "Escolher datas"],
      ].map(([k, r]) => (
        <Botao key={k} ativo={id === k} onClick={() => setId(k)}>
          {r}
        </Botao>
      ))}
      {id === "outro" && (
        <span className="flex items-center gap-1.5 text-[12px]">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border border-white/10 bg-[#0f1116] px-2 py-1 text-white" />
          até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-lg border border-white/10 bg-[#0f1116] px-2 py-1 text-white" />
        </span>
      )}
    </div>
  );
  return { periodo, seletor };
}
