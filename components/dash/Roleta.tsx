"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tocar } from "@/lib/dash/som";
import { Avatar } from "@/components/dash/ui";

// A roleta do sorteio: uma fita de participantes passando e freando até parar
// no ganhador -- que já foi sorteado pelo servidor. Quem tem mais bilhetes
// aparece mais vezes na fita, como numa roleta de verdade.

type Pessoa = { handle: string; foto: string | null; bilhetes: number };

const LARGURA = 132; // de cada casa da fita
const CASAS = 64;
const PARADA = 54; // em que casa o ganhador para

function montarFita(lista: Pessoa[], ganhador: Pessoa) {
  const total = lista.reduce((s, p) => s + Math.max(1, p.bilhetes), 0) || 1;
  const fita: Pessoa[] = [];
  for (let i = 0; i < CASAS; i++) {
    if (i === PARADA) {
      fita.push(ganhador);
      continue;
    }
    let alvo = Math.random() * total;
    let escolhido = lista[0] ?? ganhador;
    for (const p of lista) {
      alvo -= Math.max(1, p.bilhetes);
      if (alvo <= 0) {
        escolhido = p;
        break;
      }
    }
    fita.push(escolhido);
  }
  return fita;
}

export default function Roleta({
  participantes,
  ganhador,
  premio,
  titulo,
  volume = 0.5,
  duracaoMs = 6500,
  aoTerminar,
  grande = false,
}: {
  participantes: Pessoa[];
  ganhador: Pessoa;
  premio?: string | null;
  titulo?: string;
  volume?: number;
  duracaoMs?: number;
  aoTerminar?: () => void;
  grande?: boolean;
}) {
  const fita = useMemo(() => montarFita(participantes.length ? participantes : [ganhador], ganhador), [participantes, ganhador]);
  const caixa = useRef<HTMLDivElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const [parou, setParou] = useState(false);
  const escala = grande ? 1.35 : 1;
  const casa = LARGURA * escala;

  useEffect(() => {
    const el = trilho.current;
    const box = caixa.current;
    if (!el || !box) return;
    const meio = box.clientWidth / 2;
    // Para um pouco fora do centro da casa: parece de verdade, não de mentira.
    const folga = (Math.random() - 0.5) * casa * 0.5;
    const fim = -(PARADA * casa + casa / 2 - meio + folga);
    el.style.transition = "none";
    el.style.transform = "translateX(0px)";
    let ultimoIndice = -1;
    let quadro = 0;
    const tiques = () => {
      const x = new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
      const i = Math.floor((meio - x) / casa);
      if (i !== ultimoIndice) {
        ultimoIndice = i;
        tocar("tique", volume);
      }
      quadro = requestAnimationFrame(tiques);
    };
    const inicio = requestAnimationFrame(() => {
      el.style.transition = `transform ${duracaoMs}ms cubic-bezier(0.12, 0.8, 0.12, 1)`;
      el.style.transform = `translateX(${fim}px)`;
      quadro = requestAnimationFrame(tiques);
    });
    const t = setTimeout(() => {
      cancelAnimationFrame(quadro);
      setParou(true);
      tocar("sorteio", volume);
      aoTerminar?.();
    }, duracaoMs + 150);
    return () => {
      cancelAnimationFrame(inicio);
      cancelAnimationFrame(quadro);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fita]);

  return (
    <div className="w-full">
      {titulo && <p className={`mb-3 text-center font-display font-extrabold text-white ${grande ? "text-4xl" : "text-xl"}`}>{titulo}</p>}
      <div ref={caixa} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 py-4">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-1 -translate-x-1/2 bg-brand-yellow shadow-[0_0_18px_#F4AF14]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black/70 to-transparent" />
        <div ref={trilho} className="flex will-change-transform">
          {fita.map((p, i) => (
            <div
              key={i}
              className={`flex shrink-0 flex-col items-center gap-2 px-2 ${parou && i === PARADA ? "scale-110" : ""} transition-transform`}
              style={{ width: casa }}
            >
              <Avatar foto={p.foto} nome={p.handle} tamanho={Math.round(64 * escala)} />
              <span className={`max-w-full truncate font-semibold ${grande ? "text-[16px]" : "text-[12px]"} ${parou && i === PARADA ? "text-brand-yellow" : "text-white/80"}`}>
                @{p.handle}
              </span>
            </div>
          ))}
        </div>
      </div>
      {parou && (
        <div className="dash-entrar mt-5 text-center">
          <p className={`font-display font-extrabold text-brand-yellow ${grande ? "text-5xl" : "text-3xl"}`}>🎉 @{ganhador.handle}</p>
          {premio && <p className={`mt-1 text-white/80 ${grande ? "text-2xl" : "text-[15px]"}`}>ganhou {premio}</p>}
        </div>
      )}
    </div>
  );
}
