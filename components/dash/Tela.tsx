"use client";

import { useEffect, useRef, useState } from "react";
import type { RespostaTela } from "@/lib/dash/api";
import { destravarAudio } from "@/lib/dash/som";
import Roleta from "@/components/dash/Roleta";
import { Avatar, Barra } from "@/components/dash/ui";

// A tela limpa da live, para o OBS (fonte Navegador) ou para compartilhar.
// Parâmetros do link:
//   k      chave da conta (obrigatória)
//   v      sorteio | metas | carpas | compradores | geral
//   f      16x9 | 9x16
//   s      só este sorteio
//   show   uma live específica (senão, a live atual da conta)
//   fundo  escuro | transparente | verde
//   valores 0 esconde o dinheiro
//   som    0 deixa a roleta muda

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Sorteio = RespostaTela["sorteios"][number];

function BlocoSorteio({ s, vertical }: { s: Sorteio; vertical: boolean }) {
  const top = s.participantes.slice(0, vertical ? 10 : 12);
  const ultimo = [...s.ganhadores].reverse().find((g) => g.status === "valido");
  return (
    <div className="rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-3xl font-extrabold text-white">{s.nome}</p>
          {s.premio && <p className="mt-1 text-xl font-semibold text-brand-yellow">🎁 {s.premio}</p>}
          <p className="mt-1 text-[15px] text-white/60">{s.nomeFonte}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-extrabold text-white">{inteiro(s.totalParticipantes)}</p>
          <p className="text-[13px] text-white/60">concorrendo</p>
        </div>
      </div>
      {s.marcos && (
        <div className="mt-4">
          <Barra progresso={s.marcos.progresso} />
          <p className="mt-2 text-lg text-white/85">
            {s.marcos.disponiveis > 0 ? (
              <b className="text-[#6fdc94]">🎉 Sorteio liberado!</b>
            ) : (
              <>
                Faltam <b className="text-brand-yellow">{inteiro(s.marcos.faltaParaProximo)}</b> {s.unidade} para o próximo sorteio
              </>
            )}
          </p>
        </div>
      )}
      <div className={`mt-5 grid gap-2 ${vertical ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {top.map((p) => (
          <div key={p.handle} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2">
            <Avatar foto={p.foto} nome={p.handle} tamanho={36} />
            <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-white">@{p.handle}</span>
            <span className="text-[15px] font-bold text-brand-yellow">{s.totalBilhetes ? ((p.bilhetes / s.totalBilhetes) * 100).toFixed(1) : 0}%</span>
          </div>
        ))}
      </div>
      {ultimo && (
        <p className="mt-4 text-center text-lg text-white/80">
          Último ganhador: <b className="text-brand-yellow">@{ultimo.handle}</b>
        </p>
      )}
    </div>
  );
}

function BlocoMetas({ metas, valores }: { metas: RespostaTela["metas"]; valores: boolean }) {
  if (!metas.length) return null;
  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur">
      {metas.map((m) => {
        const dinheiro = m.tipo === "faturamento";
        const fmt = (n: number) => (dinheiro ? (valores ? reais(n) : "•••") : inteiro(n));
        return (
          <div key={m.id}>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold text-white">🎯 {m.nome || "Meta"}</p>
              {m.escopo === "live" && m.batida && <span className="rounded-full bg-brand-green px-3 py-1 text-[15px] font-bold text-white">BATIDA!</span>}
            </div>
            {m.premio && <p className="text-lg text-brand-yellow">🎁 {m.premio}</p>}
            {m.escopo === "pessoa" ? (
              <div className="mt-2">
                <p className="text-[16px] text-white/75">
                  Quem chegar a {fmt(m.alvo)} {dinheiro ? "" : m.unidade} ganha!
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(m.bateram ?? []).map((p) => (
                    <span key={p.handle} className="flex items-center gap-2 rounded-full bg-brand-green/25 px-3 py-1 text-[15px] font-semibold text-white">
                      <Avatar foto={p.foto} nome={p.handle} tamanho={24} />@{p.handle} ✅
                    </span>
                  ))}
                  {(m.perto ?? []).slice(0, 3).map((p) => (
                    <span key={p.handle} className="rounded-full bg-white/10 px-3 py-1 text-[15px] text-white/80">
                      @{p.handle} {fmt(p.atual)}
                    </span>
                  ))}
                </div>
              </div>
            ) : m.tipo === "posicao" ? (
              <p className="mt-1 text-xl text-white/85">
                Agora <b>#{m.atual || "?"}</b> · meta <b className="text-brand-yellow">#{m.alvo}</b>
              </p>
            ) : (
              <div className="mt-2">
                <div className="h-4 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ${m.batida ? "bg-brand-green" : "bg-brand-yellow"}`}
                    style={{ width: `${Math.round(m.progresso * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-lg text-white/85">
                  {fmt(m.atual)} / {fmt(m.alvo)} {dinheiro ? "" : m.unidade}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: { handle: string; foto: string | null; valor: string }[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur">
      <p className="mb-3 font-display text-2xl font-extrabold text-white">{titulo}</p>
      <ol className="space-y-2">
        {itens.map((p, i) => (
          <li key={p.handle} className="flex items-center gap-3">
            <span className={`w-8 text-center font-display text-xl font-extrabold ${i < 3 ? "text-brand-yellow" : "text-white/50"}`}>{i + 1}</span>
            <Avatar foto={p.foto} nome={p.handle} tamanho={36} />
            <span className="min-w-0 flex-1 truncate text-[18px] font-semibold text-white">@{p.handle}</span>
            <span className="text-[18px] font-bold text-white">{p.valor}</span>
          </li>
        ))}
      </ol>
      {!itens.length && <p className="text-lg text-white/50">Ninguém ainda.</p>}
    </div>
  );
}

export default function Tela({ parametros }: { parametros: Record<string, string> }) {
  const [q] = useState(() => new URLSearchParams(parametros));
  const [dados, setDados] = useState<RespostaTela | null>(null);
  const [erro, setErro] = useState("");
  const [roleta, setRoleta] = useState<{ chave: string; s: Sorteio; ganhador: { handle: string; foto: string | null; bilhetes: number } } | null>(null);
  const vistos = useRef<Set<string> | null>(null);

  const v = q.get("v") ?? "sorteio";
  const vertical = q.get("f") === "9x16";
  const fundo = q.get("fundo") ?? "escuro";
  const valores = q.get("valores") !== "0";
  const soSorteio = q.get("s");
  const volume = q.get("som") === "0" ? 0 : 0.6;

  useEffect(() => {
    let parado = false;
    let t: ReturnType<typeof setTimeout>;
    const buscar = async () => {
      try {
        const p = new URLSearchParams({ k: q.get("k") ?? "" });
        if (q.get("show")) p.set("show", q.get("show")!);
        const r = await fetch(`/api/dash/tela?${p}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
        const d = j as RespostaTela;
        setDados(d);
        setErro("");
        // Ganhador novo (sorteado no painel): a roleta roda aqui também.
        const todos = d.sorteios.flatMap((s) => s.ganhadores.map((g) => ({ s, g })));
        if (vistos.current === null) {
          vistos.current = new Set(todos.map((x) => x.g.id));
        } else {
          const novo = todos.find((x) => !vistos.current!.has(x.g.id) && x.g.status === "valido" && (!soSorteio || x.s.id === soSorteio));
          for (const x of todos) vistos.current.add(x.g.id);
          if (novo) setRoleta({ chave: novo.g.id, s: novo.s, ganhador: { handle: novo.g.handle, foto: novo.g.foto, bilhetes: novo.g.bilhetes } });
        }
      } catch (e) {
        setErro(String((e as Error).message));
      }
      if (!parado) t = setTimeout(buscar, 3000);
    };
    buscar();
    return () => {
      parado = true;
      clearTimeout(t);
    };
  }, [q, soSorteio]);

  useEffect(() => {
    if (fundo === "transparente") {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    }
  }, [fundo]);

  const corFundo = fundo === "transparente" ? "bg-transparent" : fundo === "verde" ? "bg-[#00ff00]" : "bg-gradient-to-br from-[#0f1116] via-[#151924] to-[#1d1608]";

  if (erro && !dados) {
    return <div className={`flex min-h-screen items-center justify-center ${corFundo} p-8 text-center text-2xl text-white/70`}>{erro}</div>;
  }
  if (!dados) return <div className={`min-h-screen ${corFundo}`} />;

  const sorteios = dados.sorteios.filter((s) => !soSorteio || s.id === soSorteio);
  const carpas = dados.topCarpas.map((p) => ({ handle: p.handle, foto: p.foto, valor: `${inteiro(p.n)} 🐟` }));
  const compradores = dados.topCompradores.map((p) => ({ handle: p.handle, foto: p.foto, valor: valores ? reais(p.total) : `${p.itens} itens` }));
  const t = dados.totais;

  return (
    <div className={`min-h-screen ${corFundo} p-6 text-white`} onPointerDown={destravarAudio}>
      <div className={`mx-auto ${vertical ? "max-w-[620px]" : "max-w-[1700px]"}`}>
        {(v === "geral" || v === "sorteio") && dados.live && (
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="min-w-0 flex-1 truncate font-display text-3xl font-extrabold">{dados.live.titulo}</p>
            <span className="text-2xl font-bold text-brand-yellow">🐟 {inteiro(t.carpas)}</span>
            {v === "geral" && <span className="text-2xl font-bold">💎 {inteiro(t.gemas)}</span>}
            {v === "geral" && dados.ranking?.posicao && <span className="text-2xl font-bold">🏆 #{dados.ranking.posicao}</span>}
          </div>
        )}

        {v === "sorteio" && (
          <div className={`grid gap-5 ${vertical || sorteios.length < 2 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
            {sorteios.map((s) => (
              <BlocoSorteio key={s.id} s={s} vertical={vertical} />
            ))}
            {!sorteios.length && <p className="text-center text-2xl text-white/50">Nenhum sorteio na tela.</p>}
          </div>
        )}

        {v === "metas" && <BlocoMetas metas={dados.metas} valores={valores} />}
        {v === "carpas" && <Lista titulo="🐟 Ranking de carpas" itens={carpas} />}
        {v === "compradores" && <Lista titulo="🛒 Quem mais comprou" itens={compradores} />}

        {v === "geral" && (
          <div className={`grid gap-5 ${vertical ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
            <div className="space-y-5">
              {sorteios.slice(0, 1).map((s) => (
                <BlocoSorteio key={s.id} s={s} vertical />
              ))}
            </div>
            <div className="space-y-5">
              <BlocoMetas metas={dados.metas} valores={valores} />
              {dados.live?.leilao && dados.live.leilao.situacao === "rolando" && (
                <div className="rounded-3xl border border-white/10 bg-black/45 p-6">
                  <p className="text-lg text-white/60">Leilão agora</p>
                  <p className="font-display text-2xl font-extrabold">{dados.live.leilao.titulo}</p>
                  {valores && <p className="mt-1 text-3xl font-bold text-[#6fdc94]">{reais(Number(dados.live.leilao.melhor || dados.live.leilao.inicial || 0))}</p>}
                  {dados.live.leilao.vencedor && <p className="text-lg">@{dados.live.leilao.vencedor}</p>}
                </div>
              )}
            </div>
            <div className="space-y-5">
              <Lista titulo="🐟 Top carpas" itens={carpas.slice(0, 5)} />
              <Lista titulo="🛒 Top compradores" itens={compradores.slice(0, 5)} />
            </div>
          </div>
        )}
      </div>

      {roleta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-8">
          <div className={vertical ? "w-full max-w-[600px]" : "w-full max-w-[1200px]"}>
            <Roleta
              key={roleta.chave}
              titulo={roleta.s.nome}
              participantes={roleta.s.participantes}
              ganhador={roleta.ganhador}
              premio={roleta.s.premio}
              volume={volume}
              grande
              aoTerminar={() => setTimeout(() => setRoleta(null), 9000)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
