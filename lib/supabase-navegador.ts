"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente do Supabase no navegador, só com a chave pública. É ele que faz o
// login do cliente e guarda a sessão; o que o cliente pode ler e escrever é
// decidido pelas regras (RLS) do banco, não por este arquivo.

let unico: SupabaseClient | null = null;

export function supabaseNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return null;
  if (!unico) {
    unico = createClient(url, chave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return unico;
}
