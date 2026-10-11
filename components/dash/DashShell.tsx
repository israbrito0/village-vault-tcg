"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { BarChart3, Gift, Home, LogOut, Radio, Users } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase-navegador";
import { chamarApi, DashContexto, type Dash } from "@/lib/dash/cliente";
import type { RespostaEu } from "@/lib/dash/api";
import { destravarAudio } from "@/lib/dash/som";
import { Botao, campo } from "@/components/dash/ui";

// A moldura do Dash Village: login com a conta do site, o menu e o contexto
// (token e quem é) para as páginas. Só entra quem está em dash_membros.

function Entrar({ erroInicial }: { erroInicial?: string }) {
  const db = supabaseNavegador();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(erroInicial ?? "");
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setErro("");
    setOcupado(true);
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) setErro(error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.");
  }

  async function google() {
    if (!db) return;
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dash` } });
    if (error) setErro("Login com Google indisponível. Use e-mail e senha.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1116] px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#171a21] p-6">
        <p className="font-display text-xl font-extrabold text-white">
          DASH <span className="text-brand-yellow">VILLAGE</span>
        </p>
        <p className="mt-1 text-[13px] text-[#8b93a7]">Entre com a sua conta do site Village &amp; Vault.</p>
        <div className="mt-5 space-y-3">
          <input className={campo} type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={campo} type="password" autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p className="mt-3 text-[12px] text-[#ff8a8a]">{erro}</p>}
        <Botao type="submit" cor="amarelo" disabled={ocupado} className="mt-4 w-full py-2.5 text-[13px]">
          {ocupado ? "Entrando..." : "Entrar"}
        </Botao>
        <Botao onClick={google} className="mt-2 w-full py-2.5 text-[13px]">
          Entrar com Google
        </Botao>
        <p className="mt-4 text-center text-[11px] text-[#8b93a7]">
          Esqueceu a senha?{" "}
          <Link href="/conta" className="text-brand-yellow underline">
            Criar uma nova
          </Link>
        </p>
      </form>
    </div>
  );
}

const MENU = [
  { href: "/dash", rotulo: "Início", icone: Home, exato: true },
  { href: "/dash/painel", rotulo: "Painel", icone: Radio },
  { href: "/dash/sorteios", rotulo: "Sorteios & Metas", icone: Gift },
  { href: "/dash/lives", rotulo: "Lives", icone: BarChart3 },
  { href: "/dash/clientes", rotulo: "Clientes", icone: Users },
];

export default function DashShell({ children }: { children: ReactNode }) {
  const db = supabaseNavegador();
  const caminho = usePathname() ?? "/dash";
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [eu, setEu] = useState<RespostaEu | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!db) return setSessao(null);
    db.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = db.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, [db]);

  const token = sessao?.access_token ?? "";

  const recarregarEu = useCallback(async () => {
    if (!token) return;
    try {
      setEu(await chamarApi<RespostaEu>(token, "/api/dash/eu"));
      setErro("");
    } catch (e) {
      setErro(String((e as Error).message));
    }
  }, [token]);

  useEffect(() => {
    recarregarEu();
    if (!token) return;
    const t = setInterval(recarregarEu, 30000);
    return () => clearInterval(t);
  }, [token, recarregarEu]);

  const valor = useMemo<Dash | null>(
    () =>
      token && eu
        ? { token, eu, recarregarEu, chamar: (c, o) => chamarApi(token, c, o) }
        : null,
    [token, eu, recarregarEu],
  );

  if (sessao === undefined) return <div className="min-h-screen bg-[#0f1116]" />;
  if (!sessao) return <Entrar />;
  if (erro === "sem acesso") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1116] px-4 text-center">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-[#171a21] p-6">
          <p className="font-display text-lg font-extrabold text-white">Sem acesso ao Dash</p>
          <p className="mt-2 text-[13px] text-[#8b93a7]">
            A conta <b className="text-white">{sessao.user.email}</b> não está liberada. Peça para o dono adicionar este e-mail.
          </p>
          <Botao className="mt-4" onClick={() => db?.auth.signOut()}>
            Entrar com outra conta
          </Botao>
        </div>
      </div>
    );
  }
  if (!valor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1116] text-[13px] text-[#8b93a7]">
        {erro ? `Não consegui carregar: ${erro}` : "Carregando..."}
      </div>
    );
  }

  return (
    <DashContexto.Provider value={valor}>
      <div className="min-h-screen bg-[#0f1116] text-[#e8eaef]" onPointerDown={destravarAudio}>
        <header className="dash-sem-impressao sticky top-0 z-30 border-b border-white/[0.06] bg-[#0f1116]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5">
            <Link href="/dash" className="shrink-0 font-display text-[15px] font-extrabold text-white">
              DASH <span className="text-brand-yellow">VILLAGE</span>
            </Link>
            <nav className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {MENU.map((m) => {
                const ativo = m.exato ? caminho === m.href : caminho.startsWith(m.href);
                const Icone = m.icone;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                      ativo ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icone size={14} />
                    {m.rotulo}
                  </Link>
                );
              })}
            </nav>
            <span className="hidden truncate text-[11px] text-[#8b93a7] md:block">@{valor.eu.membro.conta}</span>
            <button onClick={() => db?.auth.signOut()} title="Sair" className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-4">{children}</main>
      </div>
    </DashContexto.Provider>
  );
}
