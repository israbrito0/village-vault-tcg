"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Gavel, MessageCircle, Send, Timer, Trophy } from "lucide-react";
import { maiorLance, proximoMinimo, reais, type Lance, type Lote } from "@/lib/leilao";

type Mensagem = { id: string; nome: string; texto: string; em: number };
type Dados = {
  demo: boolean;
  leilao: { id: string; titulo: string; descricao: string | null; estado: string } | null;
  lotes: Lote[];
  lances: Lance[];
  mensagens: Mensagem[];
};
type Participante = { id: string; nome: string };

const CHAVE_LOCAL = "vv-leilao-participante";
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
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [enviando, setEnviando] = useState(false);
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
    try {
      const salvo = localStorage.getItem(CHAVE_LOCAL);
      if (salvo) setParticipante(JSON.parse(salvo));
    } catch {}
  }, [buscar]);

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
  const aberto = loteAtual?.estado === "aberto" && (restante ?? 0) > 0;
  const euGanhando = Boolean(maior && participante && maior.participanteId === participante.id);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await fetch("/api/leilao/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome, whatsapp: whats }),
      });
      const resposta = await r.json();
      if (!r.ok) {
        setErro(resposta.erro ?? "Não consegui te cadastrar.");
        return;
      }
      const pessoa = { id: resposta.id, nome: resposta.nome };
      try {
        localStorage.setItem(CHAVE_LOCAL, JSON.stringify(pessoa));
      } catch {}
      setParticipante(pessoa);
    } finally {
      setEnviando(false);
    }
  }

  async function darLance(centavos: number) {
    if (!loteAtual || !participante) return;
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      const r = await fetch("/api/leilao/lance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loteId: loteAtual.id, participanteId: participante.id, nome: participante.nome, centavos }),
      });
      const resposta = await r.json();
      if (!r.ok) setErro(resposta.erro ?? "Lance recusado.");
      else {
        setAviso("Lance registrado!");
        setValorLivre("");
      }
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leilaoId: dados.leilao.id, participanteId: participante.id, nome: participante.nome, texto: msg }),
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
              <span className="text-[10px]"> · referência, não é o preço da loja</span>
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
            <form onSubmit={entrar} className="mt-4 space-y-2 rounded-lg border border-card-border bg-surface p-3">
              <p className="text-[12px] font-bold text-ink">Entre para dar lance</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-card-border px-3 py-2"
                />
                <input
                  value={whats}
                  onChange={(e) => setWhats(e.target.value)}
                  inputMode="tel"
                  placeholder="WhatsApp com DDD"
                  className="w-full rounded-lg border border-card-border px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-full bg-brand-yellow px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-ink disabled:opacity-60"
              >
                Entrar no leilão
              </button>
              <p className="text-[10px] text-muted">
                Seu WhatsApp serve para combinar o pagamento e o envio. Ele não aparece para os outros.
              </p>
            </form>
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
                    darLance(c);
                  }}
                  className="shrink-0 rounded-full border border-card-border px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-ink disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Entrou como <strong className="text-ink">{participante.nome}</strong>. Lance dado é compromisso de compra.
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

      {/* ------------------------------------------------------------- chat */}
      <section className="rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          <MessageCircle size={14} />
          Chat do leilão
        </p>
        <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-[13px]">
          {dados.mensagens.length === 0 && <p className="text-muted">Ninguém falou ainda. Manda um oi.</p>}
          {dados.mensagens.map((m) => (
            <p key={m.id}>
              <strong className="text-ink">{m.nome}</strong> <span className="text-ink/80">{m.texto}</span>
            </p>
          ))}
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
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
