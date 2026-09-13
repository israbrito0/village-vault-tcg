"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut, MapPin, Truck, User } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase-navegador";

type Endereco = {
  id: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  principal: boolean;
};

type OpcaoFrete = { id: number; nome: string; empresa: string; centavos: number; prazoDias: number | null };

const CAMPO = "w-full rounded-lg border border-card-border px-3 py-2 text-[14px]";
const BOTAO = "rounded-full px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide disabled:opacity-50";

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const enderecoVazio = { cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };

export default function ContaCliente() {
  const db = supabaseNavegador();
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<"entrar" | "criar" | "esqueci" | "nova-senha">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [recado, setRecado] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [novo, setNovo] = useState(enderecoVazio);
  const [frete, setFrete] = useState<OpcaoFrete[] | null>(null);

  useEffect(() => {
    if (!db) {
      setCarregando(false);
      return;
    }
    db.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregando(false);
    });
    const { data } = db.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      // Chegou pelo link de "esqueci a senha": pede a senha nova.
      if (evento === "PASSWORD_RECOVERY") setModo("nova-senha");
    });
    return () => data.subscription.unsubscribe();
  }, [db]);

  const carregarPerfil = useCallback(async () => {
    if (!db || !sessao) return;
    const uid = sessao.user.id;
    const { data: perfil } = await db.from("clientes").select("nome, whatsapp").eq("id", uid).maybeSingle();
    if (perfil) {
      setNome(perfil.nome ?? "");
      setWhats(perfil.whatsapp ?? "");
    } else {
      // Primeira vez: cria o perfil com o que veio no cadastro (ou do Google).
      const meta = sessao.user.user_metadata ?? {};
      const nomeInicial = String(meta.nome ?? meta.full_name ?? meta.name ?? sessao.user.email?.split("@")[0] ?? "");
      await db.from("clientes").insert({ id: uid, nome: nomeInicial, whatsapp: meta.whatsapp ?? null });
      setNome(nomeInicial);
      setWhats(String(meta.whatsapp ?? ""));
    }
    const { data: lista } = await db
      .from("enderecos")
      .select("*")
      .eq("cliente_id", uid)
      .order("principal", { ascending: false });
    setEnderecos((lista ?? []) as Endereco[]);
  }, [db, sessao]);

  useEffect(() => {
    carregarPerfil();
  }, [carregarPerfil]);

  function limparRecados() {
    setErro("");
    setRecado("");
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    limparRecados();
    setOcupado(true);
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) setErro(error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.");
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    limparRecados();
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (nome.trim().length < 2) return setErro("Escreva seu nome.");
    setOcupado(true);
    const { data, error } = await db.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: { nome: nome.trim(), whatsapp: whats.replace(/\D/g, "") },
        emailRedirectTo: `${window.location.origin}/conta`,
      },
    });
    setOcupado(false);
    if (error) return setErro(error.message.includes("registered") ? "Esse e-mail já tem conta. Tente entrar." : error.message);
    setSenha("");
    if (!data.session) setRecado("Conta criada! Enviamos um e-mail de confirmação. Clique no link e depois entre aqui.");
  }

  async function esqueci(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    limparRecados();
    setOcupado(true);
    await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/conta` });
    setOcupado(false);
    // Mesma resposta exista ou não a conta, para não revelar quem é cliente.
    setRecado("Se esse e-mail tiver conta, chegou um link para criar uma senha nova.");
  }

  async function salvarNovaSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    limparRecados();
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    setOcupado(true);
    const { error } = await db.auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) return setErro("Não consegui trocar a senha. Peça o link de novo.");
    setSenha("");
    setModo("entrar");
    setRecado("Senha trocada.");
  }

  async function entrarComGoogle() {
    if (!db) return;
    limparRecados();
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/conta` },
    });
    if (error) setErro("O login com Google ainda está sendo ativado. Use e-mail e senha por enquanto.");
  }

  async function salvarPerfil() {
    if (!db || !sessao) return;
    limparRecados();
    const { error } = await db
      .from("clientes")
      .update({ nome: nome.trim(), whatsapp: whats.replace(/\D/g, "") || null })
      .eq("id", sessao.user.id);
    if (error) setErro("Não consegui salvar.");
    else setRecado("Dados salvos.");
  }

  async function buscarCep(cep: string) {
    const numeros = cep.replace(/\D/g, "");
    setNovo((n) => ({ ...n, cep }));
    if (numeros.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${numeros}/json/`);
      const d = await r.json();
      if (d.erro) return setErro("CEP não encontrado.");
      setErro("");
      setNovo((n) => ({
        ...n,
        rua: d.logradouro ?? n.rua,
        bairro: d.bairro ?? n.bairro,
        cidade: d.localidade ?? n.cidade,
        uf: d.uf ?? n.uf,
      }));
    } catch {
      // Sem internet para o ViaCEP: a pessoa preenche na mão.
    }
  }

  async function salvarEndereco(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !sessao) return;
    limparRecados();
    const cep = novo.cep.replace(/\D/g, "");
    if (cep.length !== 8 || !novo.rua || !novo.numero || !novo.bairro || !novo.cidade || novo.uf.length !== 2) {
      return setErro("Preencha CEP, rua, número, bairro, cidade e UF.");
    }
    const { error } = await db.from("enderecos").insert({
      cliente_id: sessao.user.id,
      ...novo,
      cep,
      uf: novo.uf.toUpperCase(),
      complemento: novo.complemento || null,
      principal: enderecos.length === 0,
    });
    if (error) return setErro("Não consegui salvar o endereço.");
    setNovo(enderecoVazio);
    setRecado("Endereço salvo.");
    carregarPerfil();
  }

  async function tornarPrincipal(id: string) {
    if (!db || !sessao) return;
    await db.from("enderecos").update({ principal: false }).eq("cliente_id", sessao.user.id);
    await db.from("enderecos").update({ principal: true }).eq("id", id);
    setFrete(null);
    carregarPerfil();
  }

  async function apagarEndereco(id: string) {
    if (!db) return;
    await db.from("enderecos").delete().eq("id", id);
    carregarPerfil();
  }

  async function calcularFrete() {
    const principal = enderecos.find((e) => e.principal) ?? enderecos[0];
    if (!principal) return setErro("Cadastre um endereço primeiro.");
    limparRecados();
    setFrete(null);
    const r = await fetch("/api/frete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cep: principal.cep, pacote: "carta" }),
    });
    const d = await r.json();
    if (!r.ok) return setErro(d.erro ?? "Não consegui calcular o frete.");
    setFrete(d.opcoes ?? []);
  }

  async function sair() {
    await db?.auth.signOut();
    setEnderecos([]);
    setFrete(null);
  }

  if (!db) return <p className="rounded-xl border border-card-border bg-white p-5 text-center">Conta indisponível no momento.</p>;
  if (carregando) return <p className="rounded-xl border border-card-border bg-white p-5 text-center">Carregando…</p>;

  const recados = (
    <>
      {erro && <p className="rounded-lg bg-brand-red/10 px-3 py-2 text-[13px] font-medium text-brand-red">{erro}</p>}
      {recado && <p className="rounded-lg bg-brand-green/10 px-3 py-2 text-[13px] font-medium text-brand-green">{recado}</p>}
    </>
  );

  // ------------------------------------------------------------ sem login
  if (!sessao || modo === "nova-senha") {
    return (
      <div className="mx-auto max-w-sm space-y-3 rounded-xl border border-card-border bg-white p-5">
        {modo !== "nova-senha" && modo !== "esqueci" && (
          <div className="grid grid-cols-2 rounded-full border border-card-border p-1">
            {(["entrar", "criar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModo(m);
                  limparRecados();
                }}
                className={`rounded-full py-2 text-[12px] font-bold uppercase ${modo === m ? "bg-brand-yellow text-ink" : "text-muted"}`}
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>
        )}

        {recados}

        {modo === "nova-senha" ? (
          <form onSubmit={salvarNovaSenha} className="space-y-2">
            <p className="font-bold text-ink">Crie uma senha nova</p>
            <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha nova (8+ caracteres)" className={CAMPO} />
            <button disabled={ocupado} className={`${BOTAO} w-full bg-brand-yellow text-ink`}>Salvar senha</button>
          </form>
        ) : modo === "esqueci" ? (
          <form onSubmit={esqueci} className="space-y-2">
            <p className="font-bold text-ink">Esqueci minha senha</p>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" className={CAMPO} />
            <button disabled={ocupado} className={`${BOTAO} w-full bg-brand-yellow text-ink`}>Mandar link</button>
            <button type="button" onClick={() => setModo("entrar")} className="w-full text-[12px] text-brand-blue">Voltar</button>
          </form>
        ) : (
          <form onSubmit={modo === "entrar" ? entrar : criarConta} className="space-y-2">
            {modo === "criar" && (
              <>
                <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Nome" className={CAMPO} />
                <input value={whats} onChange={(e) => setWhats(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="WhatsApp com DDD" className={CAMPO} />
              </>
            )}
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={CAMPO} />
            <input
              type="password"
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={modo === "entrar" ? "Senha" : "Crie uma senha (8+ caracteres)"}
              className={CAMPO}
            />
            <button disabled={ocupado} className={`${BOTAO} w-full bg-brand-yellow text-ink`}>
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </button>
            {modo === "entrar" && (
              <button type="button" onClick={() => setModo("esqueci")} className="w-full text-[12px] text-brand-blue">
                Esqueci minha senha
              </button>
            )}
          </form>
        )}

        {modo !== "nova-senha" && modo !== "esqueci" && (
          <button type="button" onClick={entrarComGoogle} className={`${BOTAO} w-full border border-card-border text-ink`}>
            Entrar com Google
          </button>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ com login
  const principal = enderecos.find((e) => e.principal) ?? enderecos[0];
  // Veio do leilão (ou do carrinho): mostra o caminho de volta. Só aceita
  // endereço interno do site, nunca um link de fora.
  const voltar =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("voltar") ?? "" : "";
  const voltarSeguro = voltar.startsWith("/") && !voltar.startsWith("//") ? voltar : "";
  return (
    <div className="space-y-3">
      {voltarSeguro && (
        <a
          href={voltarSeguro}
          className="block rounded-xl border-2 border-brand-green bg-brand-green/10 p-3 text-center text-[13px] font-bold text-brand-green"
        >
          Pronto, você está na sua conta. Voltar para onde estava →
        </a>
      )}
      {recados}

      <section className="rounded-xl border border-card-border bg-white p-4">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          <User size={14} />
          Seus dados
        </p>
        <p className="mt-1 text-[12px] text-muted">{sessao.user.email}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className={CAMPO} />
          <input value={whats} onChange={(e) => setWhats(e.target.value)} inputMode="tel" placeholder="WhatsApp com DDD" className={CAMPO} />
        </div>
        <div className="mt-2 flex justify-between">
          <button type="button" onClick={salvarPerfil} className={`${BOTAO} bg-brand-yellow text-ink`}>Salvar</button>
          <button type="button" onClick={sair} className={`${BOTAO} inline-flex items-center gap-1 text-muted`}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-card-border bg-white p-4">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          <MapPin size={14} />
          Endereços de entrega
        </p>
        <ul className="mt-2 space-y-2">
          {enderecos.map((e) => (
            <li key={e.id} className={`rounded-lg border p-3 text-[13px] ${e.principal ? "border-brand-yellow bg-brand-yellow/5" : "border-card-border"}`}>
              <p className="text-ink">
                {e.rua}, {e.numero}
                {e.complemento ? ` · ${e.complemento}` : ""}
              </p>
              <p className="text-muted">
                {e.bairro} · {e.cidade}/{e.uf} · {e.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}
              </p>
              <div className="mt-1 flex gap-3 text-[12px]">
                {e.principal ? (
                  <span className="font-bold text-brand-yellow-text">Principal</span>
                ) : (
                  <button type="button" onClick={() => tornarPrincipal(e.id)} className="text-brand-blue">Usar como principal</button>
                )}
                <button type="button" onClick={() => apagarEndereco(e.id)} className="text-brand-red">Apagar</button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={salvarEndereco} className="mt-3 space-y-2 border-t border-card-border pt-3">
          <p className="text-[12px] font-bold text-ink">Novo endereço</p>
          <input value={novo.cep} onChange={(e) => buscarCep(e.target.value)} inputMode="numeric" placeholder="CEP (preenche o resto)" className={CAMPO} />
          <input value={novo.rua} onChange={(e) => setNovo({ ...novo, rua: e.target.value })} placeholder="Rua" className={CAMPO} />
          <div className="grid grid-cols-2 gap-2">
            <input value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} placeholder="Número" className={CAMPO} />
            <input value={novo.complemento} onChange={(e) => setNovo({ ...novo, complemento: e.target.value })} placeholder="Complemento" className={CAMPO} />
          </div>
          <input value={novo.bairro} onChange={(e) => setNovo({ ...novo, bairro: e.target.value })} placeholder="Bairro" className={CAMPO} />
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <input value={novo.cidade} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} placeholder="Cidade" className={CAMPO} />
            <input value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value.slice(0, 2) })} placeholder="UF" className={CAMPO} />
          </div>
          <button className={`${BOTAO} w-full bg-brand-yellow text-ink`}>Salvar endereço</button>
        </form>
      </section>

      {principal && (
        <section className="rounded-xl border border-card-border bg-white p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Truck size={14} />
            Frete para o seu endereço
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Saindo de Maceió para {principal.cidade}/{principal.uf}, uma carta avulsa em envelope com top loader.
          </p>
          <button type="button" onClick={calcularFrete} className={`${BOTAO} mt-2 border border-card-border text-ink`}>Calcular frete</button>
          {frete && (
            <ul className="mt-2 space-y-1 text-[13px]">
              {frete.length === 0 && <li className="text-muted">Nenhuma opção de entrega para esse CEP.</li>}
              {frete.map((o) => (
                <li key={o.id} className="flex justify-between gap-3">
                  <span className="text-ink">
                    {o.empresa} {o.nome}
                    {o.prazoDias ? <span className="text-muted"> · até {o.prazoDias} dias úteis</span> : null}
                  </span>
                  <strong>{reais(o.centavos)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
