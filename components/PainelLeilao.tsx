"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Lock, Play, Search, Square, Wallet } from "lucide-react";
import { reais, type Lance, type Lote } from "@/lib/leilao";

type Carta = {
  id: string;
  nome: string;
  numero: string;
  colecao: string;
  totalOficial?: number;
  raridade?: string;
  imagem: string;
  precos: { referenciaBrl?: number; cardmarketEur?: number; tcgplayerUsd?: number; fonte?: string };
  precoManualCentavos: number | null;
  precosPorCondicao?: Record<string, number>;
};

type Estado = {
  leilao: { id: string; titulo: string } | null;
  lotes: Lote[];
  lances: Lance[];
};

const CHAVE_LOCAL = "vv-metricas-chave";

function centavosDe(texto: string) {
  const limpo = texto.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

const CAMPO = "w-full rounded-lg border border-card-border px-3 py-2 text-[13px]";
const BOTAO = "rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-wide";

export default function PainelLeilao() {
  const [chave, setChave] = useState<string | null>(null);
  const [digitada, setDigitada] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [codigo, setCodigo] = useState("");
  const [fator, setFator] = useState("1.3");
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [escolhida, setEscolhida] = useState<Carta | null>(null);
  const [titulo, setTitulo] = useState("");
  const [inicial, setInicial] = useState("");
  const [incremento, setIncremento] = useState("");
  const [precoRef, setPrecoRef] = useState("");
  const [recado, setRecado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fotoPropria, setFotoPropria] = useState("");
  const [caixas, setCaixas] = useState<
    { nome: string; centavos: number; whatsapp: string; lotes: { titulo: string; centavos: number }[] }[] | null
  >(null);

  const painel = useCallback(
    async (corpo: Record<string, unknown>) => {
      const r = await fetch("/api/leilao/painel", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${chave ?? digitada}` },
        body: JSON.stringify(corpo),
      });
      return { ok: r.ok, dados: await r.json().catch(() => ({})) };
    },
    [chave, digitada],
  );

  const atualizar = useCallback(async () => {
    const { ok, dados } = await painel({ acao: "estado" });
    if (ok) setEstado(dados as Estado);
    return ok;
  }, [painel]);

  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE_LOCAL);
      if (salva) setChave(salva);
    } catch {}
  }, []);

  useEffect(() => {
    if (!chave) return;
    atualizar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") atualizar();
    }, 5000);
    return () => clearInterval(t);
  }, [chave, atualizar]);

  async function buscar() {
    setRecado("");
    setOcupado(true);
    setCartas([]);
    try {
      const r = await fetch("/api/cartas/buscar", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
        body: JSON.stringify({ codigo, fator: Number(fator.replace(",", ".")) || 1 }),
      });
      const dados = await r.json();
      if (!r.ok) {
        setRecado(dados.erro ?? "Não achei essa carta.");
        return;
      }
      setCartas(dados.cartas ?? []);
      if (!dados.cartas?.length) setRecado("Nenhuma carta com esse código.");
    } finally {
      setOcupado(false);
    }
  }

  async function subirFoto(arquivo: File) {
    setRecado("Subindo a foto…");
    setOcupado(true);
    try {
      const form = new FormData();
      form.append("foto", arquivo);
      const r = await fetch("/api/leilao/foto", {
        method: "POST",
        headers: { authorization: `Bearer ${chave}` },
        body: form,
      });
      const dados = await r.json();
      if (!r.ok) {
        setRecado(dados.erro ?? "Não consegui subir a foto.");
        return;
      }
      setFotoPropria(dados.url);
      setRecado("Foto pronta: é ela que vai no lote.");
    } finally {
      setOcupado(false);
    }
  }

  function escolher(carta: Carta) {
    setFotoPropria("");
    setEscolhida(carta);
    setTitulo(`${carta.nome} · ${carta.colecao} (${carta.numero}/${carta.totalOficial ?? "?"})`);
    const refCentavos = carta.precoManualCentavos ?? Math.round((carta.precos.referenciaBrl ?? 0) * 100);
    setPrecoRef(refCentavos ? (refCentavos / 100).toFixed(2).replace(".", ",") : "");
    // Sugestões: abre em metade da referência, sobe de 5% em 5%.
    const sugestaoInicial = Math.max(500, Math.round(refCentavos / 2));
    const sugestaoIncremento = Math.max(100, Math.round(refCentavos * 0.05));
    setInicial((sugestaoInicial / 100).toFixed(2).replace(".", ","));
    setIncremento((sugestaoIncremento / 100).toFixed(2).replace(".", ","));
  }

  async function adicionar() {
    if (!escolhida) return;
    const lanceInicialCentavos = centavosDe(inicial);
    const incrementoCentavos = centavosDe(incremento);
    if (!lanceInicialCentavos || !incrementoCentavos) {
      setRecado("Confira o lance inicial e o incremento.");
      return;
    }
    setOcupado(true);
    try {
      const refCentavos = centavosDe(precoRef);
      // Se você mudou o preço de referência, ele vira o preço da sua base.
      if (refCentavos && refCentavos !== Math.round((escolhida.precos.referenciaBrl ?? 0) * 100)) {
        await painel({ acao: "preco-manual", cartaId: escolhida.id, centavos: refCentavos });
      }
      const { ok, dados } = await painel({
        acao: "adicionar-lote",
        titulo,
        // A foto que você tirou vale mais que a arte oficial da carta.
        imagem: fotoPropria || escolhida.imagem,
        descricao: escolhida.raridade,
        lanceInicialCentavos,
        incrementoCentavos,
        cartaId: escolhida.id,
        precoRefCentavos: refCentavos,
      });
      setRecado(ok ? "Lote adicionado." : `Erro: ${dados?.erro ?? "não deu"}`);
      if (ok) {
        setEscolhida(null);
        setCartas([]);
        setCodigo("");
        atualizar();
      }
    } finally {
      setOcupado(false);
    }
  }

  async function abrir(loteId: string, minutos: number) {
    await painel({ acao: "abrir-lote", loteId, duracaoMs: minutos * 60000 });
    atualizar();
  }

  async function fechar(loteId: string) {
    const { dados } = await painel({ acao: "fechar-lote", loteId });
    setRecado(dados?.vencedor ? `Arrematado por ${dados.vencedor.nome}.` : "Lote fechado sem lance.");
    atualizar();
  }

  async function verCaixas() {
    if (!estado?.leilao) return;
    const { dados } = await painel({ acao: "caixas", leilaoId: estado.leilao.id });
    setCaixas(dados?.caixas ?? []);
  }

  if (!chave) {
    return (
      <form
        className="mx-auto max-w-sm space-y-3 rounded-xl border border-card-border bg-white p-5 text-center"
        onSubmit={async (e) => {
          e.preventDefault();
          const valor = digitada.trim();
          if (!valor) return;
          const r = await fetch("/api/leilao/painel", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${valor}` },
            body: JSON.stringify({ acao: "estado" }),
          });
          if (!r.ok) return setRecado("Chave inválida.");
          try {
            localStorage.setItem(CHAVE_LOCAL, valor);
          } catch {}
          setChave(valor);
        }}
      >
        <Lock size={22} className="mx-auto text-brand-blue" />
        <p className="font-bold text-ink">Painel do leilão</p>
        <input
          type="password"
          value={digitada}
          onChange={(e) => setDigitada(e.target.value)}
          placeholder="chave"
          className={`${CAMPO} text-center`}
        />
        {recado && <p className="text-[12px] text-brand-red">{recado}</p>}
        <button type="submit" className={`${BOTAO} w-full bg-brand-yellow text-ink`}>
          Entrar
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------- cadastrar carta */}
      <section className="rounded-xl border border-card-border bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Cadastrar carta no leilão</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Código (232/091), id (sv04.5-232) ou nome"
            className={CAMPO}
          />
          <input
            value={fator}
            onChange={(e) => setFator(e.target.value)}
            title="Fator Brasil: multiplica o preço internacional"
            className={`${CAMPO} sm:w-24`}
          />
          <button type="button" onClick={buscar} disabled={ocupado} className={`${BOTAO} shrink-0 bg-brand-yellow text-ink`}>
            <Search size={14} className="mr-1 inline" />
            Buscar
          </button>
        </div>
        {recado && <p className="mt-2 text-[12px] font-medium text-ink">{recado}</p>}

        {cartas.length > 0 && (
          <ul className="mt-3 space-y-2">
            {cartas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-card-border p-2">
                {c.imagem ? (
                  <Image src={c.imagem} alt="" width={44} height={61} className="rounded" unoptimized />
                ) : (
                  <span className="grid h-[61px] w-11 place-items-center rounded bg-surface text-[9px] text-muted">sem foto</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{c.nome}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {c.colecao} · {c.numero}/{c.totalOficial ?? "?"} · {c.raridade ?? ""}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {c.precoManualCentavos
                      ? `seu preço: ${reais(c.precoManualCentavos)}`
                      : c.precos.referenciaBrl
                        ? `ref: R$ ${c.precos.referenciaBrl.toFixed(2)} (${c.precos.fonte})`
                        : "sem preço"}
                  </span>
                </span>
                <button type="button" onClick={() => escolher(c)} className={`${BOTAO} shrink-0 border border-card-border text-ink`}>
                  Usar
                </button>
              </li>
            ))}
          </ul>
        )}

        {escolhida && (
          <div className="mt-3 space-y-2 rounded-lg border border-brand-yellow bg-brand-yellow/5 p-3">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={CAMPO} />
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[10px] uppercase text-muted">
                Lance inicial
                <input value={inicial} onChange={(e) => setInicial(e.target.value)} className={CAMPO} />
              </label>
              <label className="text-[10px] uppercase text-muted">
                Incremento
                <input value={incremento} onChange={(e) => setIncremento(e.target.value)} className={CAMPO} />
              </label>
              <label className="text-[10px] uppercase text-muted">
                Valor de mercado
                <input value={precoRef} onChange={(e) => setPrecoRef(e.target.value)} className={CAMPO} />
              </label>
            </div>
            {escolhida.precosPorCondicao && Object.keys(escolhida.precosPorCondicao).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-muted">Seus preços:</span>
                {Object.entries(escolhida.precosPorCondicao).map(([cond, cent]) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setPrecoRef((cent / 100).toFixed(2).replace(".", ","))}
                    className="rounded-full border border-card-border px-2 py-0.5 font-medium text-ink"
                  >
                    {cond} {reais(cent)}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              {fotoPropria ? (
                <Image src={fotoPropria} alt="" width={48} height={66} className="rounded" unoptimized />
              ) : null}
              <label className="flex-1 text-[11px] text-ink">
                Foto da sua carta (abre a câmera no celular)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const arq = e.target.files?.[0];
                    if (arq) subirFoto(arq);
                  }}
                  className="mt-1 block w-full text-[11px]"
                />
              </label>
            </div>
            <p className="text-[10px] text-muted">
              Sem foto sua, entra a arte oficial da carta. Se você mudar o valor de mercado, ele passa a valer
              como o seu preço para essa carta.
            </p>
            <button type="button" onClick={adicionar} disabled={ocupado} className={`${BOTAO} w-full bg-brand-yellow text-ink`}>
              Adicionar ao leilão
            </button>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- os lotes */}
      <section className="rounded-xl border border-card-border bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            {estado?.leilao ? estado.leilao.titulo : "Nenhum leilão criado"}
          </p>
          <button type="button" onClick={verCaixas} className={`${BOTAO} border border-card-border text-ink`}>
            <Wallet size={13} className="mr-1 inline" />
            Caixas
          </button>
        </div>

        <ul className="mt-2 space-y-2">
          {(estado?.lotes ?? []).map((lote) => {
            const lances = (estado?.lances ?? []).filter((l) => l.loteId === lote.id);
            const maior = lances.sort((a, b) => b.centavos - a.centavos)[0];
            return (
              <li key={lote.id} className="rounded-lg border border-card-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {lote.ordem}. {lote.titulo}
                  </span>
                  <span className="shrink-0 text-[11px] uppercase text-muted">{lote.estado}</span>
                </div>
                <p className="text-[11px] text-muted">
                  abre em {reais(lote.lanceInicialCentavos)} · sobe {reais(lote.incrementoCentavos)}
                  {maior ? ` · agora ${reais(maior.centavos)} com ${maior.nome}` : ""}
                  {lote.vencedorNome ? ` · arrematado por ${lote.vencedorNome}` : ""}
                </p>
                {lote.estado !== "encerrado" && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[1, 2, 5].map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => abrir(lote.id, min)}
                        className={`${BOTAO} border border-card-border text-ink`}
                      >
                        <Play size={12} className="mr-1 inline" />
                        {min} min
                      </button>
                    ))}
                    <button type="button" onClick={() => fechar(lote.id)} className={`${BOTAO} border border-card-border text-brand-red`}>
                      <Square size={12} className="mr-1 inline" />
                      Fechar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {estado?.lotes.length === 0 && <li className="text-[13px] text-muted">Nenhum lote ainda. Cadastre a primeira carta acima.</li>}
        </ul>
      </section>

      {caixas && (
        <section className="rounded-xl border border-card-border bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Caixas para cobrar</p>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {caixas.length === 0 && <li className="text-muted">Nada arrematado ainda.</li>}
            {caixas.map((c) => (
              <li key={c.whatsapp + c.nome} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-ink">{c.nome}</span>
                  <span className="block text-[11px] text-muted">{c.lotes.length} lote(s)</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <strong>{reais(c.centavos)}</strong>
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-green"
                    >
                      WhatsApp
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
