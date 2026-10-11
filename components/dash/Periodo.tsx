"use client";

import { useMemo, useState } from "react";

// O filtro de período das páginas Lives e Clientes, como no Dash TCG: "De",
// "Até" e os atalhos (Hoje, Ontem, Últimos 7 dias...). No horário do aparelho.

export type Periodo = { de: number; ate: number; rotulo: string };

const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const paraCampo = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const doCampo = (v: string) => {
  const [a, m, d] = v.split("-").map(Number);
  return new Date(a, m - 1, d).getTime();
};

export type Atalho = "hoje" | "ontem" | "7d" | "30d" | "mes" | "tudo";

const NOMES: Record<Atalho, string> = { hoje: "Hoje", ontem: "Ontem", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", mes: "Este mês", tudo: "Tudo" };

function intervalo(a: Atalho) {
  const hoje = dia(new Date());
  const amanha = hoje + 86400000;
  if (a === "hoje") return { de: hoje, ate: amanha };
  if (a === "ontem") return { de: hoje - 86400000, ate: hoje };
  if (a === "7d") return { de: amanha - 7 * 86400000, ate: amanha };
  if (a === "30d") return { de: amanha - 30 * 86400000, ate: amanha };
  if (a === "mes") {
    const d = new Date();
    return { de: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), ate: amanha };
  }
  return { de: 0, ate: 0 };
}

export function usePeriodo(atalhos: Atalho[], inicial: Atalho = "tudo") {
  const [de, setDe] = useState(() => (intervalo(inicial).de ? paraCampo(intervalo(inicial).de) : ""));
  const [ate, setAte] = useState(() => (intervalo(inicial).ate ? paraCampo(intervalo(inicial).ate - 86400000) : ""));
  const [ativo, setAtivo] = useState<Atalho | null>(inicial);

  const periodo: Periodo = useMemo(() => {
    const d = de ? doCampo(de) : 0;
    const a = ate ? doCampo(ate) + 86400000 : dia(new Date()) + 86400000;
    return { de: d, ate: a, rotulo: ativo ? NOMES[ativo] : `${de || "início"} a ${ate || "hoje"}` };
  }, [de, ate, ativo]);

  const escolher = (a: Atalho) => {
    const i = intervalo(a);
    setDe(i.de ? paraCampo(i.de) : "");
    setAte(i.ate ? paraCampo(i.ate - 86400000) : "");
    setAtivo(a);
  };

  const campos = (
    <>
      <label className="d-label flex flex-col gap-1.5">
        De
        <input
          className="d-field"
          type="date"
          value={de}
          onChange={(e) => {
            setDe(e.target.value);
            setAtivo(null);
          }}
        />
      </label>
      <label className="d-label flex flex-col gap-1.5">
        Até
        <input
          className="d-field"
          type="date"
          value={ate}
          onChange={(e) => {
            setAte(e.target.value);
            setAtivo(null);
          }}
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {atalhos.map((a) => (
          <button key={a} type="button" className={`d-chip ${ativo === a ? "d-chip-on" : ""}`} onClick={() => escolher(a)}>
            {NOMES[a]}
          </button>
        ))}
      </div>
    </>
  );
  return { periodo, campos };
}
