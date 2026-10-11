"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { montarFita, type Pessoa } from "@/components/dash/Roleta";
import { Avatar } from "@/components/dash/ui";
import { tocarMusica, type Musica } from "@/lib/dash/musica";
import { tocar } from "@/lib/dash/som";

// O sorteio do jeito do "Pião da Casa Própria": uma janela redonda com o
// anel laranja brilhando e, dentro, um tambor escuro girando com os nomes
// passando na horizontal -- rápido e borrado no começo, freando até parar no
// ganhador (que o servidor já sorteou) dentro da moldura do meio. A música
// toca enquanto gira e a fanfarra entra quando ele para.

export const DURACAO_PIAO = 13000;
// Ângulo entre um nome e o próximo no tambor (36°: cinco nomes por meia volta).
const PASSO = Math.PI / 5;
// Quantos nomes passam até o ganhador (mais que na fita: o pião gira mais).
const CASAS_PIAO = 116;
const PARADA_PIAO = 110;

// O caminho do tambor (em nomes) ao longo do giro, t de 0 a 1. Arranca, gira
// na velocidade máxima um bom tempo e freia até quase parar com o ganhador
// aparecendo na beirada da moldura; segura ali um instante, quase parado, e
// então cai devagar no ganhador, passa um tiquinho e volta. É o suspense da
// reta final.
const ARRANCA = 0.031; // até aqui acelera (0,4 s de 13)
const GIRA = 0.369; // até aqui gira no máximo (4,8 s)
const FREIA = 0.73; // até aqui freia (9,5 s)
const SEGURA = 0.79; // segura na beirada
const CAI = 0.945; // cai no ganhador, passando um pouco
const BEIRADA = 0.62; // quanto falta para o ganhador quando quase para
const ANDA = 0.04; // o que ainda anda enquanto segura
const PASSA = 0.1; // o quanto passa do ganhador antes de voltar
const entraESai = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

// A parte do giro até a beirada (0 a 1): velocidade subindo, constante e
// caindo com (1 - s)², somada até t.
function giroAte(t: number): number {
  const total = ARRANCA / 2 + (GIRA - ARRANCA) + (FREIA - GIRA) / 3;
  if (t < ARRANCA) return (t * t) / (2 * ARRANCA) / total;
  if (t < GIRA) return (ARRANCA / 2 + (t - ARRANCA)) / total;
  const s = (t - GIRA) / (FREIA - GIRA);
  return (ARRANCA / 2 + (GIRA - ARRANCA) + ((FREIA - GIRA) / 3) * (1 - Math.pow(1 - s, 3))) / total;
}

function posicaoDoPiao(t: number): number {
  const P = PARADA_PIAO;
  if (t < FREIA) return (P - BEIRADA) * giroAte(t);
  if (t < SEGURA) {
    const u = (t - FREIA) / (SEGURA - FREIA);
    // Quase parado: anda um fio e balança, como o pião antes de tombar.
    return P - BEIRADA + ANDA * u + 0.015 * Math.sin(u * Math.PI * 3);
  }
  if (t < CAI) return P - BEIRADA + ANDA + (BEIRADA - ANDA + PASSA) * entraESai((t - SEGURA) / (CAI - SEGURA));
  return P + PASSA * (1 - entraESai(Math.min(1, (t - CAI) / (1 - CAI))));
}

export default function Piao({
  participantes,
  ganhador,
  premio,
  volume = 0.5,
  musica,
  grande = false,
  duracaoMs = DURACAO_PIAO,
  aoTerminar,
  extra,
  sons = true,
}: {
  participantes: Pessoa[];
  ganhador: Pessoa;
  premio?: string | null;
  volume?: number;
  musica?: Musica;
  grande?: boolean;
  duracaoMs?: number;
  aoTerminar?: () => void;
  // Sem sons próprios (na tela cheia a música e a contagem são da tela).
  sons?: boolean;
  extra?: ReactNode;
}) {
  const fita = useMemo(
    () => montarFita(participantes.length ? participantes : [ganhador], ganhador, CASAS_PIAO, PARADA_PIAO),
    [participantes, ganhador],
  );
  const tambor = useRef<HTMLDivElement>(null);
  const nomes = useRef<(HTMLDivElement | null)[]>([]);
  const [lado, setLado] = useState(0);
  const [parou, setParou] = useState(false);
  // A reta final: os últimos nomes passando devagar até o ganhador.
  const [suspense, setSuspense] = useState(false);

  // O tamanho do tambor (os nomes e o giro dependem dele).
  useEffect(() => {
    const el = tambor.current;
    if (!el) return;
    const medir = () => setLado(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = tambor.current;
    if (!el) return;
    const m: Musica = musica ?? { tipo: "padrao" };
    // Em loop: uma música mais curta que o giro não acaba antes do ganhador.
    const tocando = tocarMusica({ ...m, loop: true }, volume);
    const comMusica = m.tipo !== "nenhuma" && volume > 0;
    const inicio = performance.now();
    let quadro = 0;
    let ultimo = -1;
    let antes = 0;
    let naRetaFinal = false;
    let fimDaMusica: ReturnType<typeof setTimeout> | undefined;

    const desenhar = (agora: number) => {
      const D = el.clientWidth || 300;
      const casa = D * 0.5;
      const raio = casa / PASSO;
      const t = Math.min(1, (agora - inicio) / duracaoMs);
      const pos = posicaoDoPiao(t);
      const borrao = Math.min(5, Math.abs(pos - antes) * 12);
      antes = pos;
      if (!naRetaFinal && pos > PARADA_PIAO - 2.6) {
        naRetaFinal = true;
        setSuspense(true);
      }
      for (let i = 0; i < fita.length; i++) {
        const n = nomes.current[i];
        if (!n) continue;
        const ang = (i - pos) * PASSO;
        if (Math.abs(ang) >= Math.PI / 2) {
          n.style.visibility = "hidden";
          continue;
        }
        const c = Math.cos(ang);
        n.style.visibility = "visible";
        n.style.transform = `translate(-50%, -50%) translateX(${(raio * Math.sin(ang)).toFixed(1)}px) scaleX(${c.toFixed(3)})`;
        n.style.opacity = (0.2 + 0.8 * c * c).toFixed(3);
        n.style.filter = borrao > 0.4 ? `blur(${borrao.toFixed(1)}px)` : "none";
      }
      const atual = Math.round(pos);
      if (atual !== ultimo) {
        ultimo = atual;
        if (!comMusica && sons) tocar("tique", volume);
      }
      if (t < 1) {
        quadro = requestAnimationFrame(desenhar);
        return;
      }
      setParou(true);
      tocando.vitoria();
      if (!comMusica && sons) tocar("sorteio", volume);
      aoTerminar?.();
      // A música some uns segundos depois do ganhador aparecer.
      fimDaMusica = setTimeout(() => tocando.parar(1800), m.tipo === "arquivo" ? 4500 : 2600);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => {
      cancelAnimationFrame(quadro);
      clearTimeout(fimDaMusica);
      tocando.parar(300);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fita]);

  const casa = lado * 0.5;
  // O nome cabe numa linha da casa: mede o texto com a fonte da página e
  // diminui a letra dos compridos.
  const tamanhos = useMemo(() => {
    const mapa = new Map<string, number>();
    if (!lado || typeof document === "undefined") return mapa;
    const ctx = document.createElement("canvas").getContext("2d");
    const familia = getComputedStyle(document.body).fontFamily || "sans-serif";
    for (const p of fita) {
      if (mapa.has(p.handle)) continue;
      let largura = (p.handle.length + 1) * 62;
      if (ctx) {
        ctx.font = `900 100px ${familia}`;
        largura = ctx.measureText(`@${p.handle}`).width;
      }
      mapa.set(p.handle, Math.max(10, Math.min(lado * 0.17, ((casa * 0.9) / largura) * 100)));
    }
    return mapa;
  }, [fita, lado, casa]);

  return (
    <div className="flex w-full flex-col items-center">
      <div
        ref={tambor}
        className="relative aspect-square overflow-hidden rounded-full"
        style={{
          width: grande ? "min(42vh, 440px, 84vw)" : "min(300px, 80vw)",
          background: "linear-gradient(90deg, #0b0b0d 0%, #2b2c31 16%, #575a61 36%, #6e7179 50%, #575a61 64%, #2b2c31 84%, #0b0b0d 100%)",
          boxShadow: parou
            ? "0 0 0 5px #ffe07a, 0 0 0 11px #ff9d00, 0 0 46px 22px rgba(255,170,0,.75), 0 0 110px 50px rgba(255,130,0,.4)"
            : "0 0 0 5px #ffcf4a, 0 0 0 11px rgba(255,140,0,.9), 0 0 38px 18px rgba(255,140,0,.6), 0 0 90px 40px rgba(255,110,0,.3)",
          // Na reta final o anel pulsa.
          animation: suspense && !parou ? "dTensao .42s ease-in-out infinite alternate" : undefined,
          transition: "box-shadow .4s",
        }}
      >
        {/* As faixas de cima e de baixo do tambor e os reflexos verticais. */}
        <div className="pointer-events-none absolute inset-x-0 top-[17%] h-[3%] bg-black/45" />
        <div className="pointer-events-none absolute inset-x-0 bottom-[17%] h-[3%] bg-black/45" />
        <div className="pointer-events-none absolute inset-y-0 left-[44%] w-[1.5%] bg-white/10 blur-[2px]" />
        <div className="pointer-events-none absolute inset-y-0 left-[57%] w-[1%] bg-white/10 blur-[1px]" />
        {/* A moldura do meio: onde o ganhador para. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[62%] w-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[6px] transition-all duration-500"
          style={{
            border: `${Math.max(2, lado * 0.008)}px solid ${parou ? "#ffd34d" : suspense ? "rgba(255,214,110,.9)" : "rgba(230,230,235,.75)"}`,
            boxShadow: parou ? "0 0 26px 6px rgba(255,200,60,.55), inset 0 0 30px rgba(255,200,60,.25)" : "inset 0 0 24px rgba(0,0,0,.45)",
            background: "linear-gradient(90deg, rgba(255,255,255,.02), rgba(255,255,255,.07), rgba(255,255,255,.02))",
          }}
        />
        {lado > 0 &&
          fita.map((p, i) => (
            <div
              key={i}
              ref={(n) => {
                nomes.current[i] = n;
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex items-center justify-center text-center font-black leading-none will-change-transform"
              style={{
                width: casa,
                visibility: "hidden",
                fontSize: tamanhos.get(p.handle) ?? 16,
                whiteSpace: "nowrap",
                color: parou && i === PARADA_PIAO ? "#ffd34d" : "#f4f4f6",
                textShadow: "0 3px 0 rgba(0,0,0,.55), 0 0 18px rgba(0,0,0,.35)",
                letterSpacing: "-0.02em",
              }}
            >
              <span className={`block ${parou && i === PARADA_PIAO ? "d-pulse" : ""}`}>@{p.handle}</span>
            </div>
          ))}
      </div>
      {parou ? (
        <div className={`mt-4 flex items-center justify-center gap-x-8 gap-y-2 ${grande ? "flex-row flex-wrap" : "flex-col"}`}>
          <div className="dash-entrar flex flex-col items-center text-center">
            <div className="flex items-center gap-3">
              <Avatar foto={ganhador.foto} nome={ganhador.handle} tamanho={grande ? 52 : 36} />
              <p className={`font-black text-d-gold ${grande ? "text-4xl" : "text-2xl"}`}>🎉 @{ganhador.handle}</p>
            </div>
            {premio && <p className={`mt-1.5 text-d-ink2 ${grande ? "text-xl" : "text-[15px]"}`}>ganhou {premio}</p>}
          </div>
          {/* Na tela cheia, o cronômetro do ganhador fica ao lado do nome. */}
          {extra}
        </div>
      ) : (
        <p className={`mt-6 font-bold uppercase tracking-[0.3em] ${suspense ? "d-pulse text-d-gold" : "text-d-ink3"} ${grande ? "text-lg" : "text-xs"}`}>
          {suspense ? "e o ganhador é…" : "rodando o pião…"}
        </p>
      )}
    </div>
  );
}
