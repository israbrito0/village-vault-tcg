"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabaseNavegador } from "@/lib/supabase-navegador";
import { chamarApi, DashContexto, type Dash, type LiveAberta } from "@/lib/dash/cliente";
import type { RespostaEu } from "@/lib/dash/api";
import { MolduraDash } from "@/components/dash/DashShell";

// As telas fora do menu (Tela p/ compartilhar e a do OBS) abrem com o login,
// se houver, e senão só com a chave do link. Com login dá para sortear.
export default function SessaoOpcional({ children, fundo }: { children: ReactNode; fundo?: string }) {
  const db = supabaseNavegador();
  const [token, setToken] = useState("");
  const [eu, setEu] = useState<RespostaEu | null>(null);
  const [pronto, setPronto] = useState(false);
  const [liveAberta, setLiveAberta] = useState<LiveAberta | null>(null);

  useEffect(() => {
    if (!db) return setPronto(true);
    db.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? "");
      if (!data.session) setPronto(true);
    });
  }, [db]);

  const recarregarEu = useCallback(async () => {
    if (!token) return;
    try {
      setEu(await chamarApi<RespostaEu>(token, "/api/dash/eu"));
    } catch {
      setEu(null);
    }
    setPronto(true);
  }, [token]);

  useEffect(() => {
    recarregarEu();
  }, [recarregarEu]);

  const valor = useMemo<Dash | null>(
    () =>
      token && eu
        ? { token, eu, recarregarEu, chamar: (c, o) => chamarApi(token, c, o), liveAberta, definirLiveAberta: setLiveAberta }
        : null,
    [token, eu, recarregarEu, liveAberta],
  );

  if (!pronto) return <MolduraDash fundo={fundo}>{null}</MolduraDash>;
  return (
    <MolduraDash fundo={fundo}>
      <DashContexto.Provider value={valor}>{children}</DashContexto.Provider>
    </MolduraDash>
  );
}
