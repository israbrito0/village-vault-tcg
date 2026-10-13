"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { BarChart3, ExternalLink, Home, LayoutDashboard, Laptop, LogOut, Menu, Monitor, Moon, Shield, Sun, Ticket, Trophy, Users, X } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase-navegador";
import { chamarApi, DashContexto, haQuanto, useAgora, usePreferencia, type Dash, type LiveAberta } from "@/lib/dash/cliente";
import type { RespostaEu } from "@/lib/dash/api";
import { destravarAudio } from "@/lib/dash/som";

// A moldura do Dash Village, igual à do Dash TCG: menu lateral fixo (no
// celular, um botão abre o menu), o tema claro/escuro e o login com a conta
// do site. Só entra quem está em dash_membros.

export type Tema = "claro" | "escuro" | "sistema";

export function Logo({ tamanho = 32, texto = "text-base" }: { tamanho?: number; texto?: string }) {
  return (
    <Link href="/dash" className={`flex items-center gap-2.5 font-bold tracking-tight ${texto}`}>
      <span className="flex shrink-0 items-center justify-center rounded-[10px] bg-d-brand text-d-on-brand shadow-sm" style={{ width: tamanho, height: tamanho }}>
        <Shield size={Math.round(tamanho * 0.56)} />
      </span>
      <span>
        Dash <span className="text-d-brand">Village</span>
      </span>
    </Link>
  );
}

export function MolduraDash({ children, tema, fundo }: { children: ReactNode; tema?: Tema; fundo?: string }) {
  const [salvo] = usePreferencia<Tema>("tema", "escuro");
  return (
    <div className="dash" data-tema={tema ?? salvo} data-fundo={fundo} onPointerDown={destravarAudio}>
      {children}
    </div>
  );
}

// Convidados entram só com um usuário (ex.: "leooliva"): por trás, a conta
// deles no login do site é <usuário>@usuarios.villagetcg.com.br.
const DOMINIO_DE_USUARIOS = "usuarios.villagetcg.com.br";

function Entrar() {
  const db = supabaseNavegador();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setErro("");
    setOcupado(true);
    const login = email.trim();
    const { error } = await db.auth.signInWithPassword({ email: login.includes("@") ? login : `${login.toLowerCase()}@${DOMINIO_DE_USUARIOS}`, password: senha });
    setOcupado(false);
    if (error) setErro(error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : "Usuário, e-mail ou senha incorretos.");
  }

  async function google() {
    if (!db) return;
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dash` } });
    if (error) setErro("Login com Google indisponível. Use e-mail e senha.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={entrar} className="d-card w-full max-w-sm space-y-4 p-6">
        <Logo />
        <p className="text-sm text-d-ink3">Entre com a sua conta do site Village &amp; Vault.</p>
        <label className="block space-y-1.5">
          <span className="d-label">E-mail ou usuário</span>
          <input className="d-field w-full" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block space-y-1.5">
          <span className="d-label">Senha</span>
          <input className="d-field w-full" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro && <p className="text-xs text-d-bad">{erro}</p>}
        <button type="submit" disabled={ocupado} className="d-btn d-btn-primary w-full py-2.5">
          {ocupado ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" onClick={google} className="d-btn d-btn-secondary w-full py-2.5">
          Entrar com Google
        </button>
        <p className="text-center text-xs text-d-ink3">
          Esqueceu a senha?{" "}
          <Link href="/conta" className="text-d-brand underline">
            Criar uma nova
          </Link>
        </p>
      </form>
    </div>
  );
}

type Item = { href: string; rotulo: string; icone: ComponentType<{ className?: string }>; exato?: boolean; novaAba?: boolean };

function ItemMenu({ item, ativo, aoClicar }: { item: Item; ativo: boolean; aoClicar?: () => void }) {
  const I = item.icone;
  return (
    <Link
      href={item.href}
      target={item.novaAba ? "_blank" : undefined}
      onClick={aoClicar}
      aria-current={ativo ? "page" : undefined}
      className={`flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
        ativo ? "bg-d-brand/10 text-d-brand" : "text-d-ink2 hover:bg-d-panel2 hover:text-d-ink"
      }`}
    >
      <I className="size-[18px] shrink-0" />
      <span className="truncate">{item.rotulo}</span>
      {item.novaAba && <ExternalLink className="ml-auto size-3.5 shrink-0 text-d-ink3" />}
    </Link>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-d-ink3">{titulo}</p>
      {children}
    </div>
  );
}

function Navegacao({ dash, tema, setTema, sair, aoClicar }: { dash: Dash; tema: Tema; setTema: (t: Tema) => void; sair: () => void; aoClicar?: () => void }) {
  const caminho = usePathname() ?? "/dash";
  const agora = useAgora(10000);
  const live = dash.liveAberta;
  const id = live ? encodeURIComponent(live.showId) : "";
  const sinal = dash.eu.extensaoVistaEm;
  const online = !!sinal && agora - sinal < 3 * 60 * 1000;
  const robo = dash.eu.robo;
  const roboOnline = !!robo?.rodouEm && agora - robo.rodouEm < 3 * 60 * 1000;

  const temas: [Tema, string, ComponentType<{ className?: string }>][] = [
    ["claro", "Claro", Sun],
    ["escuro", "Escuro", Moon],
    ["sistema", "Sistema", Laptop],
  ];

  return (
    <nav className="d-scroll flex h-full flex-col gap-5 overflow-y-auto px-3 py-5">
      <div className="px-2 pb-1">
        <Logo />
      </div>
      <Secao titulo="Ao vivo">
        <ItemMenu item={{ href: "/dash", rotulo: "Início", icone: Home, exato: true }} ativo={caminho === "/dash"} aoClicar={aoClicar} />
        <ItemMenu
          item={{ href: id ? `/dash/sorteios/${id}` : "/dash/sorteios", rotulo: "Sorteios & Metas", icone: Ticket }}
          ativo={caminho.startsWith("/dash/sorteios")}
          aoClicar={aoClicar}
        />
      </Secao>
      <Secao titulo="Histórico">
        <ItemMenu item={{ href: "/dash/lives", rotulo: "Lives & Relatórios", icone: Monitor }} ativo={caminho.startsWith("/dash/lives") || caminho.startsWith("/dash/relatorio")} aoClicar={aoClicar} />
        <ItemMenu item={{ href: "/dash/ranking", rotulo: "Ranking Jamble", icone: Trophy }} ativo={caminho.startsWith("/dash/ranking")} aoClicar={aoClicar} />
        <ItemMenu item={{ href: "/dash/faturamento", rotulo: "Faturamento Jamble", icone: BarChart3 }} ativo={caminho.startsWith("/dash/faturamento")} aoClicar={aoClicar} />
      </Secao>
      <Secao titulo="Clientes">
        <ItemMenu item={{ href: "/dash/clientes", rotulo: "Clientes", icone: Users }} ativo={caminho.startsWith("/dash/clientes")} aoClicar={aoClicar} />
      </Secao>
      {live && (
        <Secao titulo="Live aberta">
          <p className="truncate px-3 pb-1 text-xs text-d-ink2" title={live.titulo ?? ""}>
            @{live.vendedor} · {live.titulo}
          </p>
          <ItemMenu item={{ href: `/dash/painel/${id}`, rotulo: "Painel", icone: LayoutDashboard }} ativo={caminho.startsWith("/dash/painel")} aoClicar={aoClicar} />
          <ItemMenu item={{ href: `/dash/tela/${id}`, rotulo: "Tela p/ compartilhar", icone: Monitor, novaAba: true }} ativo={false} aoClicar={aoClicar} />
        </Secao>
      )}
      <div className="mt-auto space-y-2 border-t border-d-line pt-4">
        <div className="space-y-1.5 rounded-xl border border-d-line bg-d-panel2/60 px-3 py-2 text-xs font-medium">
          <p
            className={`flex items-center gap-2 ${roboOnline ? "text-d-ok" : "text-d-ink3"}`}
            title="O robô entra nas lives pelo link, no servidor, sem precisar do computador ligado"
          >
            <span className={`size-2 rounded-full ${roboOnline ? "d-pulse bg-d-ok" : "bg-d-ink3"}`} />
            {roboOnline ? `Robô online · ${robo.ativos} ${robo.ativos === 1 ? "live" : "lives"}` : robo?.rodouEm ? `Robô parado ${haQuanto(robo.rodouEm, agora)}` : "Robô sem sinal"}
          </p>
          <p
            className={`flex items-center gap-2 ${online ? "text-d-ok" : "text-d-ink3"}`}
            title="A extensão do Edge (opcional) manda os dados da live a cada poucos segundos"
          >
            <span className={`size-2 rounded-full ${online ? "d-pulse bg-d-ok" : "bg-d-ink3"}`} />
            {online ? "Extensão online" : sinal ? `Extensão parada ${haQuanto(sinal, agora)}` : "Extensão desligada"}
          </p>
        </div>
        <div role="radiogroup" aria-label="Tema" className="flex rounded-xl border border-d-line bg-d-panel2 p-0.5">
          {temas.map(([t, rotulo, I]) => (
            <button
              key={t}
              role="radio"
              aria-checked={tema === t}
              title={rotulo}
              onClick={() => setTema(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-medium transition ${
                tema === t ? "bg-d-panel text-d-ink shadow-sm" : "text-d-ink3 hover:text-d-ink"
              }`}
            >
              <I className="size-4 shrink-0" />
              <span>{rotulo}</span>
            </button>
          ))}
        </div>
        <button onClick={sair} className="d-btn d-btn-ghost d-btn-sm w-full justify-start">
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </nav>
  );
}

export default function DashShell({ children }: { children: ReactNode }) {
  const db = supabaseNavegador();
  const caminho = usePathname() ?? "/dash";
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [eu, setEu] = useState<RespostaEu | null>(null);
  const [erro, setErro] = useState("");
  const [tema, setTema] = usePreferencia<Tema>("tema", "escuro");
  const [menuAberto, setMenuAberto] = useState(false);
  const [liveAberta, setLiveAberta] = useState<LiveAberta | null>(null);

  useEffect(() => {
    if (!db) return setSessao(null);
    db.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = db.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, [db]);

  useEffect(() => setMenuAberto(false), [caminho]);

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

  const valor = useMemo<Dash | null>(() => {
    if (!token || !eu) return null;
    const padrao = eu.live ? { showId: eu.live.showId, titulo: eu.live.titulo, vendedor: eu.live.vendedor } : null;
    return {
      token,
      eu,
      recarregarEu,
      chamar: (c, o) => chamarApi(token, c, o),
      liveAberta: liveAberta ?? padrao,
      definirLiveAberta: setLiveAberta,
    };
  }, [token, eu, recarregarEu, liveAberta]);

  const sair = () => db?.auth.signOut();

  let conteudo: ReactNode;
  if (sessao === undefined) conteudo = <div className="min-h-screen" />;
  else if (!sessao) conteudo = <Entrar />;
  else if (erro === "sem acesso") {
    conteudo = (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="d-card max-w-sm space-y-3 p-6">
          <p className="text-lg font-bold">Sem acesso ao Dash</p>
          <p className="text-sm text-d-ink3">
            A conta <b className="text-d-ink">{sessao.user.email}</b> não está liberada. Peça para o dono adicionar este e-mail.
          </p>
          <button className="d-btn d-btn-secondary" onClick={sair}>
            Entrar com outra conta
          </button>
        </div>
      </div>
    );
  } else if (!valor) {
    conteudo = (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-d-ink3">
        <span className="size-6 animate-spin rounded-full border-2 border-d-line border-t-d-brand" />
        {erro ? `Não consegui carregar: ${erro}` : "Carregando…"}
      </div>
    );
  } else {
    conteudo = (
      <DashContexto.Provider value={valor}>
        <div className="lg:pl-64">
          <aside className="dash-sem-impressao fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-d-line bg-d-panel lg:block">
            <Navegacao dash={valor} tema={tema} setTema={setTema} sair={sair} />
          </aside>
          <div className="dash-sem-impressao sticky top-0 z-30 flex items-center justify-between border-b border-d-line bg-d-panel/90 px-4 py-2.5 backdrop-blur lg:hidden">
            <Logo />
            <button aria-label="Abrir menu" onClick={() => setMenuAberto(true)} className="d-btn d-btn-secondary d-btn-sm px-2">
              <Menu className="size-[18px] shrink-0" />
            </button>
          </div>
          {menuAberto && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button aria-label="Fechar menu" className="absolute inset-0 bg-black/50" onClick={() => setMenuAberto(false)} />
              <aside className="d-pop-in absolute inset-y-0 left-0 w-72 border-r border-d-line bg-d-panel">
                <button aria-label="Fechar menu" onClick={() => setMenuAberto(false)} className="absolute right-3 top-4 text-d-ink3 hover:text-d-ink">
                  <X className="size-5" />
                </button>
                <Navegacao dash={valor} tema={tema} setTema={setTema} sair={sair} aoClicar={() => setMenuAberto(false)} />
              </aside>
            </div>
          )}
          {children}
        </div>
      </DashContexto.Provider>
    );
  }

  return <MolduraDash tema={tema}>{conteudo}</MolduraDash>;
}
