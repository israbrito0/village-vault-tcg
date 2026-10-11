"use client";

import { useEffect, useRef, useState } from "react";
import type { Mensagem } from "@/lib/dash/calculos";
import { tocar } from "@/lib/dash/som";
import { tocarSomDaContagem, type Tocando } from "@/lib/dash/musica";

// Depois que o pião para: 10 segundos para o ganhador responder no chat. Se
// responder, aparece "Respondeu!"; se não, "MAMOU, MAMOU, MAMOU!!!".
//
// O chat chega ao Dash com alguns segundos de atraso (a Jamble, a extensão ou
// o robô, e a leitura do painel). Então, quando o tempo acaba, o Dash ainda
// espera um pouco ("conferindo o chat…") e decide pela hora da mensagem na
// Jamble: quem respondeu dentro dos 10 segundos não leva "mamou" à toa.

export const SEGUNDOS_PARA_RESPONDER = 10;
const FOLGA_MS = 5000;
// O relógio da Jamble e o do computador não batem exatos.
const TOLERANCIA_MS = 3000;
// Quanto tempo o resultado fica na tela depois da contagem (e da folga).
export const TEMPO_DO_GANHADOR_MS = SEGUNDOS_PARA_RESPONDER * 1000 + FOLGA_MS + 7000;

type Fase = "contando" | "conferindo" | "respondeu" | "mamou";

export default function RespostaDoGanhador({
  handle,
  desde,
  chat,
  volume = 0.5,
  grande = false,
  somUrl = null,
}: {
  handle: string;
  desde: number;
  chat: Mensagem[];
  volume?: number;
  grande?: boolean;
  somUrl?: string | null;
}) {
  const [agora, setAgora] = useState(() => Date.now());
  const fim = desde + SEGUNDOS_PARA_RESPONDER * 1000;
  const alvo = handle.replace(/^@/, "").toLowerCase();
  const resposta = chat.find((m) => m.handle.replace(/^@/, "").toLowerCase() === alvo && m.ts >= desde - TOLERANCIA_MS && m.ts <= fim + TOLERANCIA_MS);
  const fase: Fase = resposta ? "respondeu" : agora < fim ? "contando" : agora < fim + FOLGA_MS ? "conferindo" : "mamou";
  const restam = Math.max(0, Math.ceil((fim - agora) / 1000));

  useEffect(() => {
    if (fase === "respondeu" || fase === "mamou") return;
    const t = setInterval(() => setAgora(Date.now()), 100);
    return () => clearInterval(t);
  }, [fase]);

  // O som da contagem: o arquivo que a conta enviou toca uma vez a partir do
  // ganhador. Ele pode passar dos 10 segundos (o final mais forte do som cai
  // no "conferindo o chat…"), então só é cortado quando o ganhador responde
  // ou quando aparece o "mamou". Sem arquivo, um tique a cada segundo.
  const somDaContagem = useRef<Tocando | null>(null);
  useEffect(() => {
    if (!somUrl) return;
    const t = tocarSomDaContagem(somUrl, volume);
    somDaContagem.current = t;
    return () => t.parar(300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [somUrl]);
  useEffect(() => {
    if (fase === "respondeu" || fase === "mamou") somDaContagem.current?.parar(400);
  }, [fase]);
  const ultimoTique = useRef(-1);
  useEffect(() => {
    if (!somUrl && fase === "contando" && restam > 0 && restam !== ultimoTique.current) {
      ultimoTique.current = restam;
      tocar("tique", restam <= 3 ? volume * 1.6 : volume);
    }
  }, [fase, restam, volume, somUrl]);
  useEffect(() => {
    if (fase === "mamou") tocar("mamou", volume);
    if (fase === "respondeu") tocar("pagamento", volume);
  }, [fase, volume]);

  if (fase === "respondeu") {
    return (
      <div className="dash-entrar mt-4 text-center">
        <p className={`font-black uppercase tracking-wide text-d-ok ${grande ? "text-4xl" : "text-xl"}`}>✅ Respondeu!</p>
        {resposta?.texto && <p className={`mt-1 italic text-d-ink2 ${grande ? "text-xl" : "text-sm"}`}>“{resposta.texto.slice(0, 80)}”</p>}
      </div>
    );
  }
  if (fase === "mamou") {
    const frase = (
      <>
        <p
          className={`font-black uppercase leading-tight text-d-bad ${grande ? "text-[clamp(2.25rem,5.5vw,5.5rem)]" : "text-3xl"}`}
          style={{ textShadow: "0 0 28px rgb(var(--d-bad) / .6), 0 4px 0 rgba(0,0,0,.6)", animation: "dMamou .55s ease-in-out infinite alternate" }}
        >
          MAMOU, MAMOU, MAMOU!!!
        </p>
        <p className={`mt-2 text-d-ink2 ${grande ? "text-xl" : "text-xs"}`}>@{alvo} não respondeu em {SEGUNDOS_PARA_RESPONDER} segundos</p>
      </>
    );
    // Na tela cheia, a frase toma a tela inteira por cima do pião.
    return grande ? (
      <div
        className="pointer-events-none fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/55 px-6 text-center backdrop-blur-[2px]"
        style={{ animation: "dPopIn .45s ease-out" }}
      >
        {frase}
      </div>
    ) : (
      <div className="mt-4 text-center" style={{ animation: "dPopIn .45s ease-out" }}>
        {frase}
      </div>
    );
  }

  const fracao = fase === "contando" ? (fim - agora) / (SEGUNDOS_PARA_RESPONDER * 1000) : 0;
  const tam = grande ? 96 : 72;
  const r = tam / 2 - 6;
  const volta = 2 * Math.PI * r;
  const urgente = restam <= 3;
  return (
    <div className="mt-3 flex flex-col items-center gap-1.5 text-center">
      <div className="relative" style={{ width: tam, height: tam }}>
        <svg width={tam} height={tam} className="-rotate-90">
          <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="rgb(var(--d-line))" strokeWidth={6} />
          <circle
            cx={tam / 2}
            cy={tam / 2}
            r={r}
            fill="none"
            stroke={urgente ? "rgb(var(--d-bad))" : "rgb(var(--d-gold))"}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={volta}
            strokeDashoffset={volta * (1 - Math.max(0, Math.min(1, fracao)))}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-black tabular-nums ${urgente ? "text-d-bad" : "text-d-gold"} ${grande ? "text-5xl" : "text-3xl"}`}>
          {fase === "contando" ? restam : "0"}
        </span>
      </div>
      <p className={`font-semibold ${grande ? "text-xl" : "text-sm"} ${fase === "conferindo" ? "text-d-ink3" : "text-d-ink"}`}>
        {fase === "contando" ? `@${alvo}, responda no chat!` : "Tempo! Conferindo o chat…"}
      </p>
    </div>
  );
}
