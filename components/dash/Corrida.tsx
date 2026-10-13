"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, Maximize2, Users, Volume2, VolumeX, X } from "lucide-react";
import { participantesDaRegra, regraPadrao, type Regra } from "@/lib/dash/calculos";
import { inteiro, useDash, useLiveDash, usePreferencia } from "@/lib/dash/cliente";
import { tocar } from "@/lib/dash/som";
import { tocarMusica } from "@/lib/dash/musica";
import { useContasLive } from "@/components/dash/blocos";
import { useSortear } from "@/components/dash/Sorteios";
import RespostaDoGanhador from "@/components/dash/RespostaDoGanhador";

// A Corrida dos Macacos: cada comprador da live é um macaco com o @ na
// cabeça. No "Largar!", o servidor sorteia o ganhador do mesmo jeito do
// sorteio de compradores (1 bilhete por item) e grava em dash_ganhadores; a
// corrida é desenhada para ele cruzar a linha primeiro, com ultrapassagens
// pelo caminho. Depois vêm os 10 segundos para ele responder no chat.

export const NOME_DA_CORRIDA = "Corrida dos Macacos";
const REGRA: Regra = { ...regraPadrao("sorteio"), quem: "compra", icones: null, liberacao: "livre", metas: {}, chance: "quantidade" };
const LARGADA_MS = 3000; // 3, 2, 1, JÁ!
const CORRIDA_MS = 12000;
const MAX_NA_PISTA = 60;
const AMOSTRAS = 240;
// Onde ficam as linhas, em fração da largura da pista.
const LINHA_LARGADA = 0.08;
const LINHA_CHEGADA = 0.93;

type Corredor = { handle: string; foto?: string | null; bilhetes?: number };
type Fase = "parado" | "largada" | "correndo" | "chegou";

// Números aleatórios a partir de um texto (o id do ganhador): a mesma
// corrida sai igual se a tela redesenhar.
function aleatorios(semente: string) {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Quanto da pista cada macaco já correu (0 a 1) em cada instante. Cada um tem
// o próprio ritmo (arrancadas e cansaço); o ganhador sai mais devagar e vem
// forte no fim, cruzando a linha exatamente no último instante. Os outros
// terminam antes da linha, o segundo colado nele.
function planejar(n: number, vencedor: number, semente: string) {
  const r = aleatorios(semente);
  const outros = Array.from({ length: n }, (_, i) => i).filter((i) => i !== vencedor);
  const segundo = outros.length ? outros[Math.floor(r() * outros.length)] : -1;
  return Array.from({ length: n }, (_, i) => {
    const final = i === vencedor ? 1 : i === segundo ? 0.955 + r() * 0.03 : 0.68 + r() * 0.27;
    const rampa = i === vencedor ? 0.9 + r() * 0.4 : -0.8 + r() * 1.6;
    const a1 = 0.2 + r() * 0.25;
    const f1 = 1 + r() * 2;
    const p1 = r();
    const a2 = 0.08 + r() * 0.15;
    const f2 = 3 + r() * 3;
    const p2 = r();
    const pos = new Float32Array(AMOSTRAS + 1);
    let soma = 0;
    for (let k = 1; k <= AMOSTRAS; k++) {
      const t = k / AMOSTRAS;
      const v = Math.max(0.15, 1 + a1 * Math.sin(2 * Math.PI * (f1 * t + p1)) + a2 * Math.sin(2 * Math.PI * (f2 * t + p2))) * Math.max(0.3, 1 + rampa * (t - 0.5));
      soma += v;
      pos[k] = soma;
    }
    for (let k = 1; k <= AMOSTRAS; k++) pos[k] = (pos[k] / soma) * final;
    return pos;
  });
}

function posicao(tabela: Float32Array, t: number) {
  const x = Math.max(0, Math.min(1, t)) * AMOSTRAS;
  const k = Math.floor(x);
  if (k >= AMOSTRAS) return tabela[AMOSTRAS];
  return tabela[k] + (tabela[k + 1] - tabela[k]) * (x - k);
}

// O macaco correndo para a direita (pernas e braços animados no globals.css).
function Macaco() {
  return (
    <svg viewBox="0 0 64 64" className="block h-full w-full overflow-visible" aria-hidden>
      <path d="M18 40 C 6 40, 4 28, 12 24 C 16 22, 18 26, 15 28" fill="none" stroke="#7a4a22" strokeWidth="3.5" strokeLinecap="round" />
      <g className="perna perna-b">
        <rect x="22" y="44" width="6" height="13" rx="3" fill="#6e4220" />
      </g>
      <g className="braco braco-b">
        <rect x="38" y="33" width="5" height="12" rx="2.5" fill="#6e4220" />
      </g>
      <ellipse cx="30" cy="40" rx="14" ry="11" fill="#8b5a2b" />
      <ellipse cx="33" cy="42" rx="8" ry="7" fill="#e8c393" />
      <g className="perna perna-a">
        <rect x="32" y="45" width="6" height="13" rx="3" fill="#8b5a2b" />
      </g>
      <g className="braco braco-a">
        <rect x="40" y="34" width="5" height="12" rx="2.5" fill="#8b5a2b" />
      </g>
      <circle cx="35" cy="20" r="4.5" fill="#8b5a2b" />
      <circle cx="35" cy="20" r="2.4" fill="#e8c393" />
      <circle cx="45" cy="22" r="11" fill="#8b5a2b" />
      <ellipse cx="48.5" cy="25.5" rx="7.5" ry="6.5" fill="#e8c393" />
      <circle cx="45.5" cy="21.5" r="1.7" fill="#2a1709" />
      <circle cx="51.5" cy="21.5" r="1.7" fill="#2a1709" />
      <path d="M46 28 Q 49.5 30.5 53 28" fill="none" stroke="#2a1709" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Corrida({ showId }: { showId: string }) {
  const { definirLiveAberta } = useDash();
  const { dados: d, erro, trocar } = useLiveDash(showId);
  const c = useContasLive(d);
  const [volume] = usePreferencia("volume", 1);
  const [mudo, setMudo] = usePreferencia("sorteio-mudo", false);
  const [cheia, setCheia] = useState(false);
  const [premio, setPremio] = useState<string | null>(null);
  const { giro, erro: erroAcao, acao } = useSortear(showId, trocar, mudo ? 0 : volume, LARGADA_MS + CORRIDA_MS);

  useEffect(() => {
    if (d) definirLiveAberta({ showId, titulo: d.live.titulo, vendedor: d.live.vendedor });
  }, [d?.live.titulo, d?.live.vendedor, showId]); // eslint-disable-line react-hooks/exhaustive-deps

  const corrida = c?.sorteios.find((s) => s.nome === NOME_DA_CORRIDA && s.regra.quem === "compra") ?? null;
  const premioAtual = premio ?? corrida?.premio ?? "";

  // Antes de largar: quem vai correr (os compradores desta live, como o
  // servidor conta). Na corrida: a lista que o servidor mandou, com o ganhador.
  const naLargada = useMemo<Corredor[]>(() => {
    if (!d) return [];
    if (corrida) return corrida.concorrendo;
    return participantesDaRegra(REGRA, { emocoes: d.emocoes, mensagens: d.chat, vendas: d.vendas }, d.live.vendedor).filter((p) => !p.fora);
  }, [d, corrida]);

  const minhaCorrida = giro && corrida && giro.sorteioId === corrida.id ? giro : null;
  const corredores = useMemo<Corredor[]>(() => {
    if (!minhaCorrida) return naLargada.slice(0, MAX_NA_PISTA);
    const lista = minhaCorrida.lista.slice(0, MAX_NA_PISTA - 1).filter((p) => p.handle !== minhaCorrida.ganhador.handle);
    lista.push(minhaCorrida.ganhador);
    // Raias embaralhadas: o ganhador não fica sempre na mesma.
    const r = aleatorios(minhaCorrida.chave + ":raias");
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minhaCorrida?.chave, naLargada]);
  const vencedor = minhaCorrida ? corredores.findIndex((p) => p.handle === minhaCorrida.ganhador.handle) : -1;
  const plano = useMemo(() => (minhaCorrida && vencedor >= 0 ? planejar(corredores.length, vencedor, minhaCorrida.chave) : null), [minhaCorrida?.chave, vencedor, corredores.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // O tamanho da pista (as raias dividem a altura).
  const pista = useRef<HTMLDivElement | null>(null);
  const [medida, setMedida] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const medir = () => setMedida({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [d ? 1 : 0, cheia]);
  // Uma folga em cima para o nome do macaco da primeira raia não cortar.
  const FOLGA = 22;
  const raia = corredores.length ? Math.max(0, medida.h - FOLGA) / corredores.length : 0;
  // Com muita gente a raia fica fina: o macaco é maior que ela (fica um
  // bando, um na frente do outro) e a largada é em grade, três fileiras
  // escalonadas que se desfazem conforme a corrida anda.
  const tamanho = Math.max(28, Math.min(64, raia * 2));
  const emGrade = raia < tamanho;
  // A largada fica longe o bastante da borda para caber a grade atrás dela.
  const inicioX = Math.max(medida.w * LINHA_LARGADA, tamanho * (emGrade ? 2.75 : 0.9) + 6);
  const fimX = medida.w * LINHA_CHEGADA;
  const xDe = (p: number, i: number) => inicioX + p * (fimX - inicioX) - tamanho * 0.85 - (emGrade ? (i % 3) * tamanho * 0.9 * (1 - p) : 0);
  // A animação lê a medida de agora (a tela pode mudar de tamanho no meio).
  const xAgora = useRef(xDe);
  xAgora.current = xDe;

  // O relógio da corrida: 3, 2, 1, JÁ!, a corrida e a chegada.
  const macacos = useRef<(HTMLDivElement | null)[]>([]);
  const [fase, setFase] = useState<Fase>("parado");
  const [contagem, setContagem] = useState(3);
  const [chegouEm, setChegouEm] = useState<number | null>(null);
  useEffect(() => {
    setChegouEm(null);
    if (!minhaCorrida || !plano) {
      setFase("parado");
      return;
    }
    setFase("largada");
    setContagem(3);
    const inicio = performance.now();
    let ultimo = -1;
    let quadro = 0;
    const desenhar = (agora: number) => {
      const passou = agora - inicio;
      if (passou < LARGADA_MS) {
        const n = 3 - Math.floor(passou / 1000);
        if (n !== ultimo) {
          ultimo = n;
          setContagem(n);
          tocar("tique", mudo ? 0 : volume);
        }
        quadro = requestAnimationFrame(desenhar);
        return;
      }
      if (ultimo !== 0) {
        ultimo = 0;
        setFase("correndo");
        tocar("sorteio", mudo ? 0 : volume);
      }
      const t = (passou - LARGADA_MS) / CORRIDA_MS;
      plano.forEach((tabela, i) => {
        const el = macacos.current[i];
        if (!el) return;
        const p = posicao(tabela, t);
        el.style.transform = `translate(${xAgora.current(p, i).toFixed(1)}px, -50%)`;
        el.style.setProperty("--p", p.toFixed(3));
      });
      if (t >= 1) {
        setFase("chegou");
        setChegouEm(Date.now());
        return;
      }
      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minhaCorrida?.chave, plano]);

  // Parado: todos atrás da linha de largada (e de volta lá quando a pista muda).
  useEffect(() => {
    if (fase !== "parado" && fase !== "largada") return;
    corredores.forEach((_, i) => {
      const el = macacos.current[i];
      if (!el) return;
      el.style.transform = `translate(${xDe(0, i).toFixed(1)}px, -50%)`;
      el.style.setProperty("--p", "0");
    });
  });

  // A música da corrida toca do "3" até a chegada (depois vem o som da
  // contagem do ganhador, o da conta).
  const correndo = fase === "largada" || fase === "correndo";
  useEffect(() => {
    if (mudo || !d || !correndo) return;
    const m = tocarMusica({ tipo: "arquivo", url: d.visual.corridaMusicaUrl, loop: true }, volume || 1);
    return () => m.parar(600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correndo, mudo, d?.visual.corridaMusicaUrl]);

  if (!d || !c) {
    return (
      <main className="d-page flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-d-ink3">
        <span className="size-6 animate-spin rounded-full border-2 border-d-line border-t-d-brand" />
        {erro ? `Não consegui abrir a live: ${erro}` : "Abrindo a live…"}
      </main>
    );
  }

  async function largar() {
    let id = corrida?.id;
    const p = premioAtual.trim();
    if (!id) {
      const r = await acao({ acao: "criar", nome: NOME_DA_CORRIDA, premio: p, regra: REGRA });
      id = r?.sorteios.find((s) => s.nome === NOME_DA_CORRIDA && s.regra.quem === "compra")?.id;
      if (!id) return;
    } else if (p !== (corrida?.premio ?? "")) {
      await acao({ acao: "editar", id, premio: p });
    }
    await acao({ acao: "sortear", id });
  }

  const ganhador = minhaCorrida?.ganhador ?? null;
  const ocupado = fase !== "parado";
  const premioNaTela = minhaCorrida?.premio ?? (premioAtual.trim() || null);

  const palco = (
    <div
      className={`d-palco flex flex-col overflow-hidden ${cheia ? "fixed inset-0 z-[70]" : "relative h-[min(78vh,760px)] min-h-[420px] rounded-3xl"}`}
      data-paleta={d.visual.paleta ?? undefined}
    >
      <div className="d-palco-fundo pointer-events-none absolute inset-0" />
      <div className="d-palco-losangos pointer-events-none absolute inset-0" />
      <div className="d-palco-vinheta pointer-events-none absolute inset-0" />

      <header className="relative z-20 flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        {d.visual.letreiroUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.visual.letreiroUrl} alt="" className="h-9 w-auto rounded-lg shadow-[0_0_24px_rgb(var(--d-brand)/0.5)] sm:h-11" />
        )}
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.4em] text-d-gold/80">◆ Só compradores desta live ◆</p>
          <h1 className="d-ouro font-display text-[clamp(1.3rem,2.6vw,2.4rem)] font-extrabold uppercase leading-tight">{NOME_DA_CORRIDA}</h1>
        </div>
        {premioNaTela && (
          <span className="rounded-2xl border border-d-gold/40 bg-d-brand/10 px-3 py-1.5 text-sm">
            <span className="mr-1.5 text-[10px] font-extrabold uppercase tracking-[0.3em] text-d-gold">Prêmio</span>
            <b>{premioNaTela}</b>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-d-ink2">
          <Users className="size-3.5 text-d-gold" />
          <b className="tabular-nums text-d-ink">{inteiro(minhaCorrida ? Math.max(minhaCorrida.lista.length, corredores.length) : naLargada.length)}</b> na corrida
        </span>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-d-gold/20 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-d-ink2 hover:text-d-ink"
          onClick={() => setMudo(!mudo)}
          title={mudo ? "Ligar o som" : "Silenciar"}
        >
          {mudo ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          Som
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-d-gold/20 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-d-ink2 hover:text-d-ink"
          onClick={() => setCheia(!cheia)}
        >
          {cheia ? <X className="size-4" /> : <Maximize2 className="size-4" />}
          {cheia ? "Sair" : "Tela cheia"}
        </button>
      </header>

      {/* A pista: uma raia por macaco, a largada e a chegada quadriculada. */}
      <div ref={pista} className="relative z-10 mx-4 mb-3 min-h-0 flex-1 overflow-hidden rounded-2xl border border-d-gold/15 bg-[linear-gradient(180deg,#3a2716,#2a1b0f)]">
        {corredores.map((_, i) => (
          <div key={i} className={`absolute inset-x-0 ${i % 2 ? "bg-white/[0.035]" : ""}`} style={{ top: FOLGA + i * raia, height: raia }} />
        ))}
        <div className="absolute inset-y-0 w-[3px] bg-white/70" style={{ left: inicioX }} />
        <div
          className="absolute inset-y-0 w-[14px] opacity-90"
          style={{ left: fimX, backgroundImage: "repeating-conic-gradient(#fff 0 25%, #111 0 50%)", backgroundSize: "14px 14px" }}
        />
        <Flag className="absolute top-1 size-5 text-white" style={{ left: fimX + 16 }} />

        {corredores.map((p, i) => {
          const ganhou = fase === "chegou" && i === vencedor;
          return (
            <div
              key={p.handle}
              ref={(n) => {
                macacos.current[i] = n;
              }}
              className={`d-macaco absolute left-0 will-change-transform ${fase === "correndo" ? "correndo" : fase === "chegou" ? "" : "parado"}`}
              style={{ top: FOLGA + i * raia + raia / 2, width: tamanho, height: tamanho, zIndex: ganhou ? 500 : i + 1 }}
            >
              <span
                className={`absolute bottom-[86%] left-[40%] whitespace-nowrap rounded-full px-1.5 py-px font-bold leading-tight ${
                  ganhou ? "bg-d-brand text-d-on-brand shadow-[0_0_18px_rgb(var(--d-brand)/0.8)]" : "bg-black/70 text-white"
                }`}
                // O nome sai da cabeça para a direita na largada e vai passando para a
                // esquerda conforme o macaco avança (perto da chegada não corta na borda).
                style={{ fontSize: Math.max(9, Math.min(15, tamanho * 0.3)), transform: "translateX(calc(var(--p, 0) * -100%))" }}
              >
                @{p.handle}
              </span>
              <Macaco />
            </div>
          );
        })}

        {!corredores.length && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-d-ink3">Ninguém comprou nesta live ainda. Assim que sair a primeira venda, o macaco entra na pista.</div>
        )}

        {/* 3, 2, 1, JÁ! */}
        {fase === "largada" && (
          <div key={contagem} className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="d-ouro font-display text-[clamp(5rem,16vw,12rem)] font-extrabold leading-none" style={{ animation: "dPopIn .4s ease-out" }}>
              {contagem}
            </span>
          </div>
        )}
        {fase === "correndo" && <JaLargou />}
      </div>

      {/* Embaixo: o botão de largar, ou quem chegou primeiro e a resposta dele. */}
      <div className="relative z-20 flex min-h-[92px] flex-col items-center justify-center gap-2 px-4 pb-4">
        {fase === "chegou" && ganhador ? (
          <div className="flex flex-col items-center text-center" style={{ animation: "dPopIn .45s ease-out" }}>
            <p className="font-display text-[clamp(1.4rem,3.4vw,2.6rem)] font-extrabold text-d-gold">🏆 @{ganhador.handle} chegou primeiro!</p>
            {premioNaTela && <p className="text-sm text-d-ink2 sm:text-base">ganhou {premioNaTela}</p>}
            {chegouEm && (
              <RespostaDoGanhador
                handle={ganhador.handle}
                desde={chegouEm}
                chat={d.chat}
                volume={mudo ? 0 : volume}
                grande={cheia}
                somUrl={d.visual.contagem === "arquivo" ? d.visual.contagemUrl : null}
                frase={d.visual.semResposta}
              />
            )}
          </div>
        ) : (
          d.podeEditar && (
            <button
              className="d-botao-sortear px-14 py-3 font-display text-[clamp(1.3rem,2.4vw,2rem)] font-extrabold tracking-[0.14em] sm:px-20"
              disabled={ocupado || !naLargada.length}
              onClick={largar}
            >
              {ocupado ? "CORRENDO…" : "LARGAR!"}
            </button>
          )
        )}
        {erroAcao && <p className="text-sm text-d-bad">{erroAcao}</p>}
      </div>
    </div>
  );

  return (
    <main className="d-page space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="d-page-title">{NOME_DA_CORRIDA}</h1>
          <p className="d-page-sub">
            @{d.live.vendedor} · {d.live.titulo}
          </p>
        </div>
        {d.podeEditar && (
          <label className="flex items-center gap-2 text-sm">
            <span className="d-label">Prêmio</span>
            <input
              className="d-field w-56 px-3 py-1.5"
              placeholder="ex.: 1 booster 30th"
              value={premioAtual}
              disabled={ocupado}
              onChange={(e) => setPremio(e.target.value)}
            />
          </label>
        )}
      </header>
      <p className="text-sm text-d-ink3">
        Só os compradores desta live correm, 1 bilhete por item comprado (quem comprou mais tem mais chance). O primeiro a cruzar a linha ganha e fica
        nos ganhadores da live; depois ele tem 10 segundos para responder no chat.
      </p>
      {palco}
    </main>
  );
}

// O "JÁ!" some logo depois da largada.
function JaLargou() {
  const [ve, setVe] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVe(false), 800);
    return () => clearTimeout(t);
  }, []);
  if (!ve) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="d-ouro font-display text-[clamp(4rem,13vw,10rem)] font-extrabold leading-none" style={{ animation: "dPopIn .35s ease-out" }}>
        JÁ!
      </span>
    </div>
  );
}
