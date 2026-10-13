"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Emocao, Mensagem, Venda } from "@/lib/dash/calculos";
import { visualDoSorteio, type Icone, type LiveInfo, type Meta, type Ranking, type RespostaEu, type RespostaLive, type Sorteio, type VisualDoSorteio } from "@/lib/dash/api";

// O lado do navegador do Dash: quem está logado (contexto) e a live carregada
// aos poucos -- na primeira vez vem tudo, depois só o que é novo.

export type LiveAberta = { showId: string; titulo: string | null; vendedor: string | null };

export type Dash = {
  token: string;
  eu: RespostaEu;
  recarregarEu: () => Promise<void>;
  chamar: <T = unknown>(caminho: string, opcoes?: { metodo?: string; corpo?: unknown }) => Promise<T>;
  // A live que aparece em "Live aberta" no menu.
  liveAberta: LiveAberta | null;
  definirLiveAberta: (l: LiveAberta | null) => void;
};

export const DashContexto = createContext<Dash | null>(null);

export function useDash() {
  const d = useContext(DashContexto);
  if (!d) throw new Error("fora do Dash");
  return d;
}

export async function chamarApi<T>(token: string, caminho: string, opcoes?: { metodo?: string; corpo?: unknown }): Promise<T> {
  const r = await fetch(caminho, {
    method: opcoes?.metodo ?? (opcoes?.corpo ? "POST" : "GET"),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(opcoes?.corpo ? { "content-type": "application/json" } : {}) },
    body: opcoes?.corpo ? JSON.stringify(opcoes.corpo) : undefined,
    cache: "no-store",
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((dados as { erro?: string }).erro || `erro ${r.status}`);
  return dados as T;
}

export type LiveCarregada = {
  live: LiveInfo;
  emocoes: Emocao[];
  chat: Mensagem[];
  vendas: Venda[];
  ranking: Ranking | null;
  sorteios: Sorteio[];
  metas: Meta[];
  termos: string;
  icones: Record<string, Icone>;
  souVendedor: boolean;
  podeEditar: boolean;
  conta: string;
  visual: VisualDoSorteio;
  atualizadoEm: number;
  // Relógio do servidor menos o deste computador (para o sorteio agendado).
  desvio: number;
};

// Carrega uma live e fica buscando o que chega (a cada 3 s com a aba na
// frente, 15 s escondida). "intervalo: 0" carrega uma vez só (relatório).
// Fora do login (tela do OBS), entra com a chave da conta.
export function useLiveDash(showId: string, intervalo = 3000, chave?: string) {
  const token = useContext(DashContexto)?.token ?? "";
  const [dados, setDados] = useState<LiveCarregada | null>(null);
  const [erro, setErro] = useState("");
  const cursor = useRef({ e: 0, c: 0, vs: "" });
  const ids = useRef({ e: new Set<string>(), c: new Set<string>() });
  const atual = useRef<LiveCarregada | null>(null);
  const ocupado = useRef(false);

  const buscar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      const q = new URLSearchParams();
      if (cursor.current.e) q.set("e", String(cursor.current.e));
      if (cursor.current.c) q.set("c", String(cursor.current.c));
      if (cursor.current.vs) q.set("vs", cursor.current.vs);
      if (!token && chave) q.set("k", chave);
      const r = await chamarApi<RespostaLive>(token, `/api/dash/live/${encodeURIComponent(showId)}?${q}`);
      const antes = atual.current;
      const novasE = r.emocoes.filter((e) => !ids.current.e.has(e.id));
      const novasC = r.chat.filter((m) => !ids.current.c.has(m.id));
      for (const e of novasE) ids.current.e.add(e.id);
      for (const m of novasC) ids.current.c.add(m.id);
      // O cursor volta 2 s: uma emotion gravada um pouco atrasada não se perde
      // (o id evita repetir).
      const maxE = r.emocoes.reduce((m, e) => Math.max(m, e.ts), cursor.current.e);
      const maxC = r.chat.reduce((m, x) => Math.max(m, x.ts), cursor.current.c);
      cursor.current = { e: maxE ? maxE - 2000 : 0, c: maxC ? maxC - 2000 : 0, vs: r.vendasSig };
      const novo: LiveCarregada = {
        live: r.live,
        emocoes: novasE.length ? [...(antes?.emocoes ?? []), ...novasE] : antes?.emocoes ?? [],
        chat: novasC.length ? [...(antes?.chat ?? []), ...novasC] : antes?.chat ?? [],
        vendas: r.vendas ?? antes?.vendas ?? [],
        ranking: r.ranking,
        sorteios: r.sorteios,
        metas: r.metas,
        termos: r.termos,
        icones: r.icones,
        souVendedor: r.souVendedor,
        podeEditar: r.podeEditar,
        conta: r.conta,
        // Passa de novo pelo visualDoSorteio: o que faltar (ex.: o nome do pião)
        // fica no padrão.
        visual: visualDoSorteio({ sorteio: r.visual }),
        atualizadoEm: Date.now(),
        desvio: r.agora ? r.agora - Date.now() : antes?.desvio ?? 0,
      };
      atual.current = novo;
      setDados(novo);
      setErro("");
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      ocupado.current = false;
    }
  }, [token, showId, chave]);

  const reconectar = useCallback(() => {
    cursor.current = { e: 0, c: 0, vs: "" };
    ids.current = { e: new Set(), c: new Set() };
    atual.current = null;
    setDados(null);
    buscar();
  }, [buscar]);

  // Resposta de uma ação (sortear, criar meta...) já traz a lista nova.
  const trocar = useCallback((mudar: Partial<Pick<LiveCarregada, "sorteios" | "metas" | "termos" | "visual">>) => {
    if (!atual.current) return;
    atual.current = { ...atual.current, ...mudar };
    setDados(atual.current);
  }, []);

  useEffect(() => {
    buscar();
    if (!intervalo) return;
    let parado = false;
    let t: ReturnType<typeof setTimeout>;
    const ciclo = () => {
      if (parado) return;
      t = setTimeout(async () => {
        await buscar();
        ciclo();
      }, document.hidden ? Math.max(intervalo, 15000) : intervalo);
    };
    ciclo();
    return () => {
      parado = true;
      clearTimeout(t);
    };
  }, [buscar, intervalo]);

  return { dados, erro, reconectar, trocar, buscar };
}

// Preferência guardada só neste aparelho (sons, voz, ocultar valores...).
export function usePreferencia<T>(chave: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(`dash:${chave}`);
      if (salvo != null) setValor(JSON.parse(salvo) as T);
    } catch {}
  }, [chave]);
  const mudar = useCallback(
    (v: T) => {
      setValor(v);
      try {
        localStorage.setItem(`dash:${chave}`, JSON.stringify(v));
      } catch {}
    },
    [chave],
  );
  return [valor, mudar] as const;
}

export function useAgora(passo = 1000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), passo);
    return () => clearInterval(t);
  }, [passo]);
  return agora;
}

export function haQuanto(ts: number | null | undefined, agora = Date.now()) {
  if (!ts) return "nunca";
  const s = Math.max(0, Math.round((agora - ts) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)} dias`;
}

export const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const dataHora = (ts: number) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const hora = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export function duracao(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

export function linkDaTela(chave: string, extra: Record<string, string> = {}) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://www.villagetcg.com.br";
  return `${base}/dash/tela?${new URLSearchParams({ k: chave, ...extra })}`;
}

export async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
