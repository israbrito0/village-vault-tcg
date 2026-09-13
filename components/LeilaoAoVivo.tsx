"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Gavel, MessageCircle, Send, ShoppingBag, Timer, Trophy } from "lucide-react";
import Link from "next/link";
import { maiorLance, proximoMinimo, reais, type Lance, type Lote } from "@/lib/leilao";
import { supabaseNavegador } from "@/lib/supabase-navegador";

type Mensagem = { id: string; nome: string; texto: string; em: number; tipo?: string };
type Pagamento = { loteId: string; estado: string; pagarAte: number | null };
type Dados = {
  demo: boolean;
  leilao: { id: string; titulo: string; descricao: string | null; estado: string } | null;
  lotes: Lote[];
  lances: Lance[];
  mensagens: Mensagem[];
  pagamentos?: Pagamento[];
};
type Participante = { id: string; nome: string };

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function centavosDe(texto: string) {
  const limpo = texto.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function hora(em: number) {
  return new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function LeilaoAoVivo() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [valorLivre, setValorLivre] = useState("");
  const [texto, setTexto] = useState("");
  // Login da conta do site: o token vai em toda chamada, e o servidor descobre
  // quem é a pessoa por ele.
  const [token, setToken] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  // Painel de pagamento do arremate.
  const [pagando, setPagando] = useState<string | null>(null);
  const [precisaFrete, setPrecisaFrete] = useState<boolean | null>(null);
  const [enderecosPg, setEnderecosPg] = useState<{ id: string; cep: string; rua: string; numero: string; cidade: string; uf: string; principal: boolean }[]>([]);
  const [enderecoPg, setEnderecoPg] = useState<string | null>(null);
  const [opcoesFrete, setOpcoesFrete] = useState<{ id: number; nome: string; empresa: string; centavos: number; prazoDias: number | null }[] | null>(null);
  const [freteEscolhido, setFreteEscolhido] = useState<number | null>(null);
  const [freteACombinar, setFreteACombinar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Lance grande espera um segundo toque de confirmação — menos nos segundos
  // finais, quando parar para confirmar custaria o lote.
  const [aConfirmar, setAConfirmar] = useState<number | null>(null);
  const [limite, setLimite] = useState("");
  const [limiteAtivo, setLimiteAtivo] = useState<number | null>(null);
  const fimDoChat = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async () => {
    try {
      const r = await fetch("/api/leilao", { cache: "no-store" });
      if (r.ok) setDados(await r.json());
    } catch {
      // rede caiu; a próxima tentativa resolve
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // Quem está logado na conta do site vira participante da sala.
  useEffect(() => {
    const db = supabaseNavegador();
    if (!db) return;
    const aplicar = async (acesso: string | null, uid: string | null) => {
      setToken(acesso);
      setUsuarioId(uid);
      if (!acesso) {
        setParticipante(null);
        return;
      }
      const r = await fetch("/api/leilao/entrar", { method: "POST", headers: { authorization: `Bearer ${acesso}` } });
      const resposta = await r.json().catch(() => ({}));
      if (r.ok) setParticipante({ id: resposta.id, nome: resposta.nome });
      else {
        setParticipante(null);
        if (resposta.erro) setErro(resposta.erro);
      }
    };
    db.auth.getSession().then(({ data }) => aplicar(data.session?.access_token ?? null, data.session?.user.id ?? null));
    const { data } = db.auth.onAuthStateChange((_evento, s) => aplicar(s?.access_token ?? null, s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Relógio do cronômetro.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Tempo real do Supabase quando configurado; senão, consulta de 3 em 3s.
  useEffect(() => {
    if (!URL_SUPABASE || !CHAVE_SUPABASE) {
      const t = setInterval(() => {
        if (document.visibilityState === "visible") buscar();
      }, 3000);
      return () => clearInterval(t);
    }
    let vivo = true;
    let canal: { unsubscribe: () => void } | null = null;
    // Mesmo com tempo real, uma leitura de 20 em 20 segundos: é ela que fecha
    // lote vencido e devolve à fila o arremate que não foi pago no prazo,
    // mesmo que ninguém esteja dando lance na hora.
    const relogio = setInterval(() => {
      if (document.visibilityState === "visible") buscar();
    }, 20000);
    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (!vivo) return;
      const db = createClient(URL_SUPABASE, CHAVE_SUPABASE, { auth: { persistSession: false } });
      canal = db
        .channel("leilao-ao-vivo")
        .on("postgres_changes", { event: "*", schema: "public", table: "lances" }, () => buscar())
        .on("postgres_changes", { event: "*", schema: "public", table: "lotes" }, () => buscar())
        .on("postgres_changes", { event: "*", schema: "public", table: "mensagens" }, () => buscar())
        .subscribe();
    })();
    return () => {
      vivo = false;
      clearInterval(relogio);
      canal?.unsubscribe();
    };
  }, [buscar]);

  useEffect(() => {
    fimDoChat.current?.scrollIntoView({ block: "nearest" });
  }, [dados?.mensagens.length]);

  const loteAtual = useMemo(() => {
    if (!dados) return null;
    return (
      dados.lotes.find((l) => l.estado === "aberto") ??
      dados.lotes.find((l) => l.estado === "aguardando") ??
      null
    );
  }, [dados]);

  const maior = useMemo(
    () => (dados && loteAtual ? maiorLance(dados.lances, loteAtual.id) : null),
    [dados, loteAtual],
  );
  const minimo = loteAtual ? proximoMinimo(loteAtual, maior) : 0;
  const restante = loteAtual?.fechaEm ? Math.max(0, loteAtual.fechaEm - agora) : null;
  // Últimos 20 segundos: nada de confirmação, o lance vai direto.
  const apertado = restante !== null && restante <= 20000;
  const aberto = loteAtual?.estado === "aberto" && (restante ?? 0) > 0;
  const euGanhando = Boolean(maior && participante && maior.participanteId === participante.id);

  const cabecalho = () => ({ "content-type": "application/json", authorization: `Bearer ${token}` });

  async function darLance(centavos: number, confirmado = false) {
    if (!loteAtual || !participante) return;
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      const r = await fetch("/api/leilao/lance", {
        method: "POST",
        headers: cabecalho(),
        body: JSON.stringify({ loteId: loteAtual.id, centavos, confirmado }),
      });
      const resposta = await r.json();
      if (!r.ok) {
        // O servidor também pede confirmação: repete já confirmado se o
        // relógio estiver apertado, senão deixa o botão pedir o segundo toque.
        if (resposta.motivo === "confirmar-valor-alto") {
          if (apertado) {
            setEnviando(false);
            return darLance(centavos, true);
          }
          setAConfirmar(centavos);
          setErro("");
        } else {
          setErro(resposta.erro ?? "Lance recusado.");
        }
      } else {
        setAviso("Lance registrado!");
        setValorLivre("");
        setAConfirmar(null);
      }
      buscar();
    } finally {
      setEnviando(false);
    }
  }

  // Pagar o arremate: confere se precisa de frete (só no primeiro pagamento do
  // leilão), busca os endereços da conta e cota o frete saindo de Maceió.
  async function pagarAgora(loteId: string) {
    if (!participante || !token) return;
    setErro("");
    setPagando(loteId);
    setPrecisaFrete(null);
    setOpcoesFrete(null);
    setFreteEscolhido(null);
    setFreteACombinar(false);

    const r = await fetch("/api/leilao/pagamento", {
      method: "POST",
      headers: cabecalho(),
      body: JSON.stringify({ loteId, consultar: true, leilaoId: dados?.leilao?.id }),
    });
    const resposta = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(resposta.erro ?? "Não consegui abrir o pagamento.");
      setPagando(null);
      return;
    }
    setPrecisaFrete(Boolean(resposta.precisaFrete));
    if (!resposta.precisaFrete) return;

    const db = supabaseNavegador();
    if (!db || !usuarioId) return;
    const { data: lista } = await db
      .from("enderecos")
      .select("id, cep, rua, numero, cidade, uf, principal")
      .eq("cliente_id", usuarioId)
      .order("principal", { ascending: false });
    setEnderecosPg(lista ?? []);
    const principal = (lista ?? [])[0];
    if (principal) escolherEndereco(principal.id, principal.cep);
  }

  async function escolherEndereco(id: string, cep: string) {
    setEnderecoPg(id);
    setOpcoesFrete(null);
    setFreteEscolhido(null);
    setFreteACombinar(false);
    const r = await fetch("/api/frete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cep, pacote: "carta" }),
    });
    const resposta = await r.json().catch(() => ({}));
    if (r.status === 503) {
      // Frete ainda não configurado: segue com frete combinado depois.
      setFreteACombinar(true);
      setFreteEscolhido(-1);
      return;
    }
    if (!r.ok) return setErro(resposta.erro ?? "Não consegui calcular o frete.");
    setOpcoesFrete(resposta.opcoes ?? []);
    if (resposta.opcoes?.[0]) setFreteEscolhido(resposta.opcoes[0].id);
  }

  async function confirmarPagamento() {
    if (!pagando || !token) return;
    setErro("");
    if (precisaFrete && (!enderecoPg || freteEscolhido === null)) return setErro("Escolha o endereço e o frete.");
    // Abre a aba já no clique: navegador de celular bloqueia janela aberta depois.
    const janela = window.open("", "_blank");
    try {
      const r = await fetch("/api/leilao/pagamento", {
        method: "POST",
        headers: cabecalho(),
        body: JSON.stringify({ loteId: pagando, enderecoId: enderecoPg, freteServicoId: freteEscolhido }),
      });
      const resposta = await r.json().catch(() => ({}));
      if (!r.ok || !resposta.link) {
        janela?.close();
        setErro(resposta.erro ?? "Não consegui gerar o pagamento.");
        return;
      }
      if (janela) janela.location.href = resposta.link;
      else window.location.href = resposta.link;
      setPagando(null);
    } catch {
      janela?.close();
      setErro("Não consegui abrir o pagamento agora.");
    }
  }

  // Lance automático: guarda o teto e deixa o sistema disputar.
  async function deixarAutomatico() {
    if (!loteAtual || !participante) return;
    const centavos = centavosDe(limite);
    if (!centavos) return setErro("Escreva o valor máximo, ex.: 400,00");
    setErro("");
    setEnviando(true);
    try {
      const r = await fetch("/api/leilao/limite", {
        method: "POST",
        headers: cabecalho(),
        body: JSON.stringify({ loteId: loteAtual.id, centavos }),
      });
      const resposta = await r.json();
      if (!r.ok) {
        setErro(resposta.erro ?? "Não consegui guardar seu limite.");
        return;
      }
      setLimiteAtivo(centavos);
      setLimite("");
      setAviso(
        resposta.ganhando
          ? `Automático ligado. Você está ganhando por ${reais(resposta.centavos ?? 0)}.`
          : "Automático ligado, mas alguém tem limite maior.",
      );
      buscar();
    } finally {
      setEnviando(false);
    }
  }

  async function mandar(e: React.FormEvent) {
    e.preventDefault();
    if (!dados?.leilao || !participante || !texto.trim()) return;
    const msg = texto.trim();
    setTexto("");
    await fetch("/api/leilao/chat", {
      method: "POST",
      headers: cabecalho(),
      body: JSON.stringify({ leilaoId: dados.leilao.id, texto: msg }),
    });
    buscar();
  }

  if (!dados) return <p className="rounded-xl border border-card-border bg-white p-5 text-center">Carregando o leilão…</p>;

  if (!dados.leilao) {
    return (
      <div className="rounded-xl border border-card-border bg-white p-6 text-center">
        <Gavel size={28} className="mx-auto text-brand-yellow" />
        <p className="mt-2 font-bold text-ink">Nenhum leilão no ar agora</p>
        <p className="mt-1">O próximo é anunciado no grupo do WhatsApp e aqui nesta página.</p>
      </div>
    );
  }

  const encerrados = dados.lotes.filter((l) => l.estado === "encerrado");

  // Sua caixa: o que você já arrematou nesta sessão, mais o que está ganhando
  // agora. Ver a caixa crescer é o que faz arrematar o próximo lote.
  const pagamentoDe = (loteId: string) => dados.pagamentos?.find((p) => p.loteId === loteId);

  // Lote que a pessoa não pagou a tempo sai da caixa: ele voltou ao leilão.
  const meusArremates = participante
    ? encerrados.filter((l) => l.vencedorId === participante.id && pagamentoDe(l.id)?.estado !== "expirada")
    : [];

  // O que ela ganhou e ainda precisa pagar: vira o aviso grande com o botão.
  const aPagar = meusArremates
    .map((l) => ({ lote: l, pagamento: pagamentoDe(l.id) }))
    .filter((x) => x.pagamento?.estado === "aberta");
  const ganhandoAgora = participante
    ? dados.lotes
        .filter((l) => l.estado === "aberto")
        .map((l) => ({ lote: l, lance: maiorLance(dados.lances, l.id) }))
        .filter((x) => x.lance?.participanteId === participante.id)
    : [];
  const totalCaixa =
    meusArremates.reduce((t, l) => t + (l.vencedorCentavos ?? 0), 0) +
    ganhandoAgora.reduce((t, x) => t + (x.lance?.centavos ?? 0), 0);

  // Ranking da sessão: quem mais levou até agora.
  const ranking = Object.values(
    encerrados.reduce<Record<string, { nome: string; centavos: number; lotes: number }>>((acc, l) => {
      if (!l.vencedorId || !l.vencedorCentavos) return acc;
      const atual = acc[l.vencedorId] ?? { nome: l.vencedorNome ?? "", centavos: 0, lotes: 0 };
      atual.centavos += l.vencedorCentavos;
      atual.lotes += 1;
      acc[l.vencedorId] = atual;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.centavos - a.centavos)
    .slice(0, 5);
  const proximos = dados.lotes.filter((l) => l.estado === "aguardando" && l.id !== loteAtual?.id);
  const lancesDoLote = loteAtual
    ? dados.lances.filter((l) => l.loteId === loteAtual.id).sort((a, b) => b.em - a.em).slice(0, 8)
    : [];

  return (
    <div className="space-y-3">
      {dados.demo && (
        <p className="rounded-lg border border-brand-yellow bg-brand-yellow/10 px-3 py-2 text-center text-[12px] font-medium text-ink">
          Demonstração: os lances desta tela não valem. O leilão de verdade começa quando o banco estiver ligado.
        </p>
      )}

      {/* ------------------------------------------------------------ lote */}
      <section className="overflow-hidden rounded-xl border border-card-border bg-white shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        {loteAtual?.imagem && (
          <div className="relative h-64 w-full bg-surface sm:h-80">
            <Image src={loteAtual.imagem} alt={loteAtual.titulo} fill className="object-contain" sizes="(max-width: 672px) 100vw, 672px" />
          </div>
        )}
        <div className="p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Gavel size={14} />
            {loteAtual ? `Lote ${loteAtual.ordem}` : "Leilão"}
            {aberto && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold text-brand-red">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-red" />
                ao vivo
              </span>
            )}
          </p>
          <h2 className="mt-1 font-display text-xl font-extrabold text-ink">{loteAtual?.titulo ?? dados.leilao.titulo}</h2>
          {loteAtual?.descricao && <p className="mt-1 text-[13px] text-ink/75">{loteAtual.descricao}</p>}

          {loteAtual?.precoRefCentavos ? (
            <p className="mt-1 text-[12px] text-muted">
              Valor de mercado: <strong className="text-ink">{reais(loteAtual.precoRefCentavos)}</strong>
              {(() => {
                // Termômetro: o quanto o lance atual está abaixo (ou acima) do
                // mercado. É o número que dá coragem para o próximo lance.
                const atual = maior?.centavos ?? loteAtual.lanceInicialCentavos;
                const dif = Math.round(((atual - loteAtual.precoRefCentavos!) / loteAtual.precoRefCentavos!) * 100);
                if (dif <= -5)
                  return <span className="font-bold text-brand-green"> · {Math.abs(dif)}% abaixo do mercado</span>;
                if (dif >= 5) return <span className="font-bold text-brand-red"> · {dif}% acima do mercado</span>;
                return <span className="font-bold text-ink"> · no preço de mercado</span>;
              })()}
            </p>
          ) : null}

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">{maior ? "Lance atual" : "Lance inicial"}</p>
              <p className="font-display text-3xl font-extrabold text-ink">{reais(maior ? maior.centavos : loteAtual?.lanceInicialCentavos ?? 0)}</p>
            </div>
            {restante !== null && (
              <div className={`text-right ${restante <= 15000 && aberto ? "text-brand-red" : "text-ink"}`}>
                <p className="flex items-center justify-end gap-1 text-[11px] uppercase tracking-wide text-muted">
                  <Timer size={12} />
                  {aberto ? "fecha em" : "fechado"}
                </p>
                <p className="font-display text-3xl font-extrabold tabular-nums">
                  {aberto ? `${Math.ceil(restante / 1000)}s` : "—"}
                </p>
              </div>
            )}
          </div>

          {/* Quem está ganhando, em destaque: é o que prende a atenção. */}
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-center text-[14px] font-bold ${
              euGanhando ? "bg-brand-green/10 text-brand-green" : "bg-surface text-ink"
            }`}
          >
            {maior ? (
              euGanhando ? (
                "Você está ganhando este lote"
              ) : (
                <>
                  <span className="text-brand-yellow-text">{maior.nome}</span> está ganhando
                </>
              )
            ) : (
              "Ninguém deu lance ainda"
            )}
          </p>

          {/* ---------------------------------------------------- dar lance */}
          {!participante ? (
            <div className="mt-4 space-y-2 rounded-lg border border-card-border bg-surface p-3 text-center">
              <p className="text-[13px] font-bold text-ink">Entre na sua conta para dar lance</p>
              <p className="text-[11px] text-muted">
                É a mesma conta da loja: seus arremates, endereço e frete ficam juntos.
              </p>
              <Link
                href="/conta?voltar=/leiloes"
                className="block w-full rounded-full bg-brand-yellow px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-ink"
              >
                Entrar ou criar conta
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!aberto || enviando || euGanhando}
                  onClick={() => darLance(minimo)}
                  className="flex-1 rounded-full bg-brand-yellow px-4 py-3 text-[13px] font-bold uppercase tracking-wide text-ink disabled:opacity-50"
                >
                  {euGanhando ? "Você está ganhando" : `Dar ${reais(minimo)}`}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={valorLivre}
                  onChange={(e) => setValorLivre(e.target.value)}
                  inputMode="decimal"
                  placeholder={`Outro valor (mín. ${reais(minimo)})`}
                  className="w-full rounded-lg border border-card-border px-3 py-2"
                />
                <button
                  type="button"
                  disabled={!aberto || enviando}
                  onClick={() => {
                    const c = centavosDe(valorLivre);
                    if (!c) return setErro("Escreva o valor, ex.: 250,00");
                    // Segundo toque no mesmo valor = confirmado.
                    darLance(c, apertado || aConfirmar === c);
                  }}
                  className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-wide disabled:opacity-50 ${
                    aConfirmar !== null && aConfirmar === centavosDe(valorLivre)
                      ? "bg-brand-red text-white"
                      : "border border-card-border text-ink"
                  }`}
                >
                  {aConfirmar !== null && aConfirmar === centavosDe(valorLivre) ? "Confirmar" : "Enviar"}
                </button>
              </div>
              {aConfirmar !== null && aConfirmar === centavosDe(valorLivre) && (
                <p className="rounded-lg bg-brand-yellow/15 px-3 py-2 text-[12px] font-medium text-ink">
                  {reais(aConfirmar)} é bem acima do mínimo de {reais(minimo)}. Toque em Confirmar se for isso mesmo.
                </p>
              )}
              {/* Lance automático: quem não pode ficar grudado no celular
                  continua no páreo, e o preço sobe só o necessário. */}
              <div className="rounded-lg border border-card-border bg-surface p-3">
                <p className="text-[12px] font-bold text-ink">Deixar no automático</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Diga até quanto você vai. O sistema cobre os outros por você, de {reais(loteAtual?.incrementoCentavos ?? 0)}{" "}
                  em {reais(loteAtual?.incrementoCentavos ?? 0)}, e para no seu limite. Ninguém vê esse valor.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={limite}
                    onChange={(e) => setLimite(e.target.value)}
                    inputMode="decimal"
                    placeholder={limiteAtivo ? `Seu limite: ${reais(limiteAtivo)}` : "Seu limite, ex.: 400,00"}
                    className="w-full rounded-lg border border-card-border px-3 py-2"
                  />
                  <button
                    type="button"
                    disabled={!aberto || enviando}
                    onClick={deixarAutomatico}
                    className="shrink-0 rounded-full bg-brand-blue px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    Ligar
                  </button>
                </div>
                {limiteAtivo !== null && (
                  <p className="mt-1.5 text-[11px] font-medium text-brand-blue">
                    Automático ligado até {reais(limiteAtivo)}. Para aumentar, é só mandar um valor maior.
                  </p>
                )}
              </div>

              <p className="text-[11px] text-muted">
                Entrou como <strong className="text-ink">{participante.nome}</strong>. Lance dado é compromisso de compra.
                {apertado && aberto ? " Nos segundos finais, o lance vai direto, sem confirmação." : ""}
              </p>
            </div>
          )}

          {erro && <p className="mt-2 rounded-lg bg-brand-red/10 px-3 py-2 text-[12px] font-medium text-brand-red">{erro}</p>}
          {aviso && !erro && <p className="mt-2 text-[12px] font-medium text-brand-green">{aviso}</p>}

          {lancesDoLote.length > 0 && (
            <ol className="mt-4 space-y-1 border-t border-card-border pt-3 text-[12px]">
              {lancesDoLote.map((l, i) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className={i === 0 ? "font-bold text-ink" : "text-muted"}>{l.nome}</span>
                  <span className={i === 0 ? "font-bold text-ink" : "text-muted"}>
                    {reais(l.centavos)} <span className="text-muted">· {hora(l.em)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* ---------------------------------------------- pagar o arremate */}
      {aPagar.map(({ lote, pagamento }) => {
        const faltaMs = pagamento?.pagarAte ? Math.max(0, pagamento.pagarAte - agora) : null;
        const min = faltaMs !== null ? Math.floor(faltaMs / 60000) : null;
        const seg = faltaMs !== null ? Math.floor((faltaMs % 60000) / 1000) : null;
        return (
          <section key={lote.id} className="rounded-xl border-2 border-brand-green bg-brand-green/10 p-4 text-center">
            <p className="text-[13px] font-bold text-brand-green">🎉 Você arrematou!</p>
            <p className="mt-1 font-display text-lg font-extrabold text-ink">{lote.titulo}</p>
            <p className="font-display text-3xl font-extrabold text-ink">{reais(lote.vencedorCentavos ?? 0)}</p>
            {pagando !== lote.id ? (
              <button
                type="button"
                onClick={() => pagarAgora(lote.id)}
                className="mt-3 w-full rounded-full bg-brand-green px-4 py-3 text-[14px] font-bold uppercase tracking-wide text-white"
              >
                Pagar agora
              </button>
            ) : (
              <div className="mt-3 space-y-2 rounded-lg bg-white p-3 text-left">
                {precisaFrete === null && <p className="text-[12px] text-muted">Preparando o pagamento…</p>}

                {precisaFrete === false && (
                  <p className="text-[12px] font-medium text-brand-green">
                    Frete já pago neste leilão: este lote vai junto no mesmo envio.
                  </p>
                )}

                {precisaFrete && enderecosPg.length === 0 && (
                  <p className="text-[12px] text-ink">
                    Cadastre um endereço de entrega para calcular o frete.{" "}
                    <Link href="/conta?voltar=/leiloes" className="font-bold text-brand-blue">
                      Cadastrar endereço
                    </Link>
                  </p>
                )}

                {precisaFrete && enderecosPg.length > 0 && (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Entregar em</p>
                    {enderecosPg.map((e) => (
                      <label key={e.id} className="flex cursor-pointer items-start gap-2 text-[12px]">
                        <input
                          type="radio"
                          name={`endereco-${lote.id}`}
                          checked={enderecoPg === e.id}
                          onChange={() => escolherEndereco(e.id, e.cep)}
                          className="mt-0.5"
                        />
                        <span className="text-ink">
                          {e.rua}, {e.numero} · {e.cidade}/{e.uf}
                        </span>
                      </label>
                    ))}

                    <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-muted">Frete saindo de Maceió</p>
                    {freteACombinar && (
                      <p className="text-[12px] text-ink">O frete será combinado com a loja pelo WhatsApp.</p>
                    )}
                    {!freteACombinar && opcoesFrete === null && enderecoPg && (
                      <p className="text-[12px] text-muted">Calculando…</p>
                    )}
                    {opcoesFrete?.map((o) => (
                      <label key={o.id} className="flex cursor-pointer items-center justify-between gap-2 text-[12px]">
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`frete-${lote.id}`}
                            checked={freteEscolhido === o.id}
                            onChange={() => setFreteEscolhido(o.id)}
                          />
                          <span className="text-ink">
                            {o.empresa} {o.nome}
                            {o.prazoDias ? <span className="text-muted"> · até {o.prazoDias} dias úteis</span> : null}
                          </span>
                        </span>
                        <strong className="text-ink">{reais(o.centavos)}</strong>
                      </label>
                    ))}
                  </>
                )}

                {precisaFrete !== null && (
                  <button
                    type="button"
                    onClick={confirmarPagamento}
                    disabled={Boolean(precisaFrete) && (enderecosPg.length === 0 || freteEscolhido === null)}
                    className="w-full rounded-full bg-brand-green px-4 py-3 text-[14px] font-bold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {(() => {
                      const frete = opcoesFrete?.find((o) => o.id === freteEscolhido)?.centavos ?? 0;
                      return `Pagar ${reais((lote.vencedorCentavos ?? 0) + (precisaFrete ? frete : 0))}`;
                    })()}
                  </button>
                )}
                <button type="button" onClick={() => setPagando(null)} className="w-full text-[11px] text-muted">
                  Voltar
                </button>
              </div>
            )}
            {min !== null && seg !== null && (
              <p className={`mt-2 text-[12px] font-medium ${faltaMs! <= 60000 ? "text-brand-red" : "text-ink/75"}`}>
                Pague em {min}:{String(seg).padStart(2, "0")} — depois disso o lote volta ao leilão
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted">Pix ou cartão · o endereço de entrega você informa no pagamento</p>
          </section>
        );
      })}

      {/* ------------------------------------------------------- sua caixa */}
      {totalCaixa > 0 && (
        <section className="rounded-xl border border-brand-green/40 bg-brand-green/5 p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-green">
            <ShoppingBag size={14} />
            Sua caixa
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">{reais(totalCaixa)}</p>
          <p className="text-[12px] text-ink/75">
            {meusArremates.length > 0 && `${meusArremates.length} arrematado${meusArremates.length > 1 ? "s" : ""}`}
            {meusArremates.length > 0 && ganhandoAgora.length > 0 && " · "}
            {ganhandoAgora.length > 0 && `${ganhandoAgora.length} ganhando agora`}
          </p>
          <ul className="mt-2 space-y-0.5 text-[12px] text-ink/80">
            {meusArremates.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{l.titulo}</span>
                <span className="shrink-0 font-medium">{reais(l.vencedorCentavos ?? 0)}</span>
              </li>
            ))}
            {ganhandoAgora.map((x) => (
              <li key={x.lote.id} className="flex justify-between gap-3 text-brand-green">
                <span className="min-w-0 truncate">{x.lote.titulo} (em disputa)</span>
                <span className="shrink-0 font-medium">{reais(x.lance?.centavos ?? 0)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Tudo vai junto numa cobrança só, com um frete só, quando o leilão acabar.
          </p>
        </section>
      )}

      {/* --------------------------------------------------- ranking da sessão */}
      {ranking.length > 0 && (
        <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Trophy size={14} />
            Top do leilão de hoje
          </p>
          <ol className="mt-2 space-y-1 text-[13px]">
            {ranking.map((r, i) => (
              <li key={r.nome + i} className="flex items-center gap-2">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                    i === 0 ? "bg-brand-yellow text-ink" : "bg-surface text-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{r.nome}</span>
                <span className="shrink-0 text-muted">{r.lotes} lote{r.lotes > 1 ? "s" : ""}</span>
                <span className="w-24 shrink-0 text-right font-bold text-ink">{reais(r.centavos)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ------------------------------------------------------------- chat */}
      <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          <MessageCircle size={14} />
          Chat do leilão
        </p>
        <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-[13px]">
          {dados.mensagens.length === 0 && <p className="text-muted">Ninguém falou ainda. Manda um oi.</p>}
          {dados.mensagens.map((m) =>
            m.tipo === "sistema" ? (
              // Recado do leilão: aguardando pagamento, pagou, não pagou.
              <p
                key={m.id}
                className={`rounded-lg px-3 py-2 text-[12px] font-medium ${
                  m.texto.startsWith("✅")
                    ? "bg-brand-green/10 text-brand-green"
                    : m.texto.startsWith("❌")
                      ? "bg-brand-red/10 text-brand-red"
                      : "bg-brand-yellow/15 text-ink"
                }`}
              >
                {m.texto}
              </p>
            ) : (
              <p key={m.id}>
                <strong className="text-ink">{m.nome}</strong> <span className="text-ink/80">{m.texto}</span>
              </p>
            ),
          )}
          <div ref={fimDoChat} />
        </div>
        {participante && (
          <form onSubmit={mandar} className="mt-3 flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={400}
              placeholder="Escreva no chat"
              className="w-full rounded-lg border border-card-border px-3 py-2"
            />
            <button type="submit" className="shrink-0 rounded-full bg-brand-blue px-4 py-2 text-white">
              <Send size={16} />
            </button>
          </form>
        )}
      </section>

      {/* --------------------------------------------------- outros lotes */}
      {proximos.length > 0 && (
        <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Próximos lotes</p>
          <ol className="mt-2 space-y-1 text-[13px]">
            {proximos.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-ink">
                  {l.ordem}. {l.titulo}
                </span>
                <span className="shrink-0 text-muted">abre em {reais(l.lanceInicialCentavos)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {encerrados.length > 0 && (
        <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Trophy size={14} />
            Já arrematados
          </p>
          <ol className="mt-2 space-y-1 text-[13px]">
            {encerrados.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-ink">
                  {l.ordem}. {l.titulo}
                </span>
                <span className="shrink-0 text-muted">
                  {l.vencedorNome ? `${l.vencedorNome} · ${reais(l.vencedorCentavos ?? 0)}` : "sem lance"}
                  {(() => {
                    const pg = pagamentoDe(l.id);
                    if (!pg) return null;
                    if (pg.estado === "paga") return <span className="ml-1 text-brand-green">· pago</span>;
                    if (pg.estado === "expirada") return <span className="ml-1 text-brand-red">· não pagou</span>;
                    return <span className="ml-1 text-brand-yellow-text">· aguardando</span>;
                  })()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
