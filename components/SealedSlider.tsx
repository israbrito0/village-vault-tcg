"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SealedSlideView, SealedTheme } from "@/lib/banners";
import { MAX_INSTALLMENTS, PIX_DISCOUNT } from "@/lib/site";

// Degradê de fundo, cor dos raios de luz e dos botões por tema.
const THEMES: Record<
  SealedTheme,
  { bg: string; text: string; eyebrow: string; cta: string; glow: string; rays: string; perk: string }
> = {
  gold: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#FFF8DC_0%,#F7C948_40%,#9C5F0C_100%)]",
    text: "text-ink",
    eyebrow: "bg-ink text-brand-yellow",
    cta: "border-ink bg-ink text-white hover:bg-transparent hover:text-ink",
    glow: "bg-white/80",
    rays: "rgba(255,255,255,0.35)",
    perk: "bg-white/45",
  },
  fire: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#FFE7A3_0%,#EE7B1F_38%,#3E1604_100%)]",
    text: "text-white",
    eyebrow: "bg-black/55 text-[#FFD27A]",
    cta: "border-white bg-white text-[#9A3B0A] hover:bg-transparent hover:text-white",
    glow: "bg-[#FFD27A]/90",
    rays: "rgba(255,220,150,0.28)",
    perk: "bg-black/30",
  },
  night: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#8C95B8_0%,#333844_52%,#101217_100%)]",
    text: "text-white",
    eyebrow: "bg-brand-yellow text-ink",
    cta: "border-brand-yellow bg-brand-yellow text-ink hover:bg-transparent hover:text-brand-yellow",
    glow: "bg-[#B9C8FF]/60",
    rays: "rgba(190,205,255,0.2)",
    perk: "bg-white/10",
  },
  ocean: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#D6F3FF_0%,#1E9BDB_45%,#062C47_100%)]",
    text: "text-white",
    eyebrow: "bg-black/40 text-white",
    cta: "border-white bg-white text-brand-blue hover:bg-transparent hover:text-white",
    glow: "bg-white/75",
    rays: "rgba(255,255,255,0.28)",
    perk: "bg-black/25",
  },
  forest: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#EAFFC9_0%,#4DAF4F_42%,#0C3514_100%)]",
    text: "text-white",
    eyebrow: "bg-black/45 text-[#C8F59A]",
    cta: "border-white bg-white text-[#1F7A33] hover:bg-transparent hover:text-white",
    glow: "bg-[#C8F59A]/80",
    rays: "rgba(220,255,190,0.28)",
    perk: "bg-black/25",
  },
  crimson: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#FFD9CC_0%,#D7262F_42%,#380408_100%)]",
    text: "text-white",
    eyebrow: "bg-black/45 text-white",
    cta: "border-white bg-white text-[#B3141C] hover:bg-transparent hover:text-white",
    glow: "bg-[#FFB199]/80",
    rays: "rgba(255,215,195,0.26)",
    perk: "bg-black/25",
  },
};

const PERKS = ["Frete grátis", `Até ${MAX_INSTALLMENTS}x sem juros`, `${Math.round(PIX_DISCOUNT * 100)}% off no Pix`];

// Produtos em leque: o primeiro no meio, na frente e maior; os outros alternam
// esquerda/direita, cada passo mais para fora, menor, mais inclinado e mais atrás.
// As fotos oficiais costumam ter margem transparente: por isso se sobrepõem e a
// imagem é ampliada (imageZoom) dentro do espaço dela.
function productStyle(index: number, total: number): CSSProperties {
  const width = total > 4 ? 42 : 44;
  const step = Math.ceil(index / 2);
  const side = index % 2 === 1 ? -1 : 1;
  const maxStep = Math.ceil((total - 1) / 2);
  const spread = maxStep <= 1 ? 27 : 36 / maxStep;

  const left = index === 0 ? 50 : 50 + side * step * spread;
  const rotate = index === 0 ? 0 : side * step * 7;
  return {
    left: `${left}%`,
    width: `${index === 0 ? width + 8 : width}%`,
    height: `${index === 0 ? 92 : 80 - step * 7}%`,
    zIndex: 30 - step,
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
  };
}
const CARD_SLOTS = [
  "left-1/2 z-20 h-[90%] -translate-x-1/2",
  "left-[10%] z-10 h-[74%] -rotate-[12deg]",
  "right-[10%] z-10 h-[74%] rotate-[12deg]",
];

// Brilhos espalhados pelo banner (posição e atraso da piscada).
const SPARKLES = [
  { pos: "left-[52%] top-[14%]", delay: "0s", size: "h-1.5 w-1.5" },
  { pos: "left-[88%] top-[22%]", delay: "0.7s", size: "h-2 w-2" },
  { pos: "left-[60%] top-[80%]", delay: "1.3s", size: "h-1 w-1" },
  { pos: "left-[94%] top-[70%]", delay: "0.4s", size: "h-1.5 w-1.5" },
  { pos: "left-[45%] top-[60%]", delay: "1.9s", size: "h-1 w-1" },
  { pos: "left-[76%] top-[8%]", delay: "1.1s", size: "h-1 w-1" },
];

const AUTOPLAY_MS = 5500;

export default function SealedSlider({ slides, initialIndex = 0 }: { slides: SealedSlideView[]; initialIndex?: number }) {
  const [active, setActive] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((step: number) => setActive((a) => (a + step + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count, go]);

  if (count === 0) return null;

  return (
    <section aria-label="Destaques" className="px-3 pt-4 sm:px-5">
      <div
        className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl shadow-[0_22px_44px_-24px_rgba(51,56,68,0.7)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          setPaused(true);
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start === null) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <Slide key={slide.id} slide={slide} isActive={i === active} />
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Banner anterior"
              className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/25 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/45 sm:left-4"
            >
              <ChevronLeft size={26} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próximo banner"
              className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/25 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/45 sm:right-4"
            >
              <ChevronRight size={26} />
            </button>
            <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Mostrar banner ${slide.title}`}
                  aria-current={i === active}
                  className={`h-3 rounded-full border-2 border-white shadow transition-all ${
                    i === active ? "w-7 bg-white" : "w-3 bg-transparent hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Slide({ slide, isActive }: { slide: SealedSlideView; isActive: boolean }) {
  const theme = THEMES[slide.theme];
  const ctaClass = `mt-5 inline-flex w-fit whitespace-nowrap rounded-md border-2 px-6 py-2.5 text-[12px] font-extrabold uppercase tracking-wide shadow-lg transition-colors ${theme.cta}`;

  return (
    <article aria-hidden={!isActive} className={`relative w-full shrink-0 overflow-hidden ${theme.bg} ${theme.text}`}>
      {slide.background && (
        <>
          <Image src={slide.background} alt="" fill sizes="(min-width: 1280px) 1280px, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        </>
      )}

      {/* Raios de luz girando devagar atrás das fotos (o giro fica na camada de
          dentro para não anular o translate que centraliza). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[68%] top-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(circle,black_8%,transparent_58%)] sm:w-[110%]"
      >
        <div
          className="h-full w-full motion-safe:animate-spin-slow"
          style={{
            background: `repeating-conic-gradient(from 0deg, ${theme.rays} 0deg 5deg, transparent 5deg 15deg)`,
          }}
        />
      </div>
      {/* Textura de pontinhos. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.35)_1px,transparent_1.5px)] [background-size:18px_18px]"
      />
      {SPARKLES.map((s) => (
        <span
          key={s.pos}
          aria-hidden
          className={`pointer-events-none absolute rounded-full bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.8)] motion-safe:animate-pulse-gold ${s.pos} ${s.size}`}
          style={{ animationDelay: s.delay }}
        />
      ))}

      {/* Laterais largas o bastante para as setas não ficarem em cima do texto. */}
      <div className="relative grid min-h-[440px] grid-cols-1 items-center gap-2 px-12 pb-12 pt-8 sm:min-h-[350px] sm:grid-cols-[1fr_1.15fr] sm:px-20 lg:min-h-[410px]">
        {/* min-w-0: sem isso a palavra mais longa do título empurra as imagens para fora. */}
        <div className="z-40 flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
          <p className={`rounded-md px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] shadow ${theme.eyebrow}`}>
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold uppercase leading-[0.95] drop-shadow-[0_3px_10px_rgba(0,0,0,0.3)] sm:text-4xl lg:text-6xl">
            {slide.title}
          </h2>
          {slide.subtitle && <p className="mt-3 max-w-sm text-sm font-semibold opacity-90">{slide.subtitle}</p>}

          <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            {PERKS.map((perk) => (
              <li
                key={perk}
                className={`rounded px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide backdrop-blur-sm ${theme.perk}`}
              >
                {perk}
              </li>
            ))}
          </ul>

          {slide.external ? (
            <a href={slide.href} target="_blank" rel="noopener noreferrer" tabIndex={isActive ? 0 : -1} className={ctaClass}>
              {slide.cta} →
            </a>
          ) : (
            <Link href={slide.href} tabIndex={isActive ? 0 : -1} className={ctaClass}>
              {slide.cta} →
            </Link>
          )}
        </div>

        <div aria-hidden className="relative h-[220px] min-w-0 sm:h-full sm:min-h-[280px]">
          <div
            className={`absolute left-1/2 top-1/2 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${theme.glow}`}
          />
          {slide.photoKind === "scene" && slide.photos[0] ? (
            // Foto oficial com fundo: inteira, numa moldura levemente inclinada.
            <div className="absolute left-1/2 top-1/2 w-[96%] -translate-x-1/2 -translate-y-1/2 -rotate-2">
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl shadow-[0_22px_40px_-12px_rgba(0,0,0,0.55)] ring-4 ring-white/80 motion-safe:animate-float">
                <Image
                  src={slide.photos[0].src}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 620px, (min-width: 640px) 50vw, 90vw"
                  unoptimized={slide.photos[0].direct}
                  className="object-cover"
                />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent motion-safe:animate-shimmer" />
              </div>
            </div>
          ) : (
            slide.photos.map((photo, k) =>
              slide.photoKind === "card" ? (
                // A animação fica numa camada de dentro: no mesmo elemento ela
                // substituiria o translate que centraliza a carta.
                <div key={photo.src} className={`absolute top-1/2 -translate-y-1/2 ${CARD_SLOTS[k]}`}>
                  <div
                    className={`relative aspect-[63/88] h-full overflow-hidden rounded-[4.5%] shadow-[0_18px_30px_-8px_rgba(0,0,0,0.55)] ring-2 ring-white/60 ${
                      k === 0 ? "motion-safe:animate-float" : ""
                    }`}
                  >
                    <Image src={photo.src} alt="" fill sizes="240px" unoptimized={photo.direct} className="object-cover" />
                    {k === 0 && (
                      // Reflexo passando pela carta da frente.
                      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent motion-safe:animate-shimmer" />
                    )}
                  </div>
                </div>
              ) : (
                <div key={photo.src} className="absolute top-1/2" style={productStyle(k, slide.photos.length)}>
                  <Image
                    src={photo.src}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 320px, 45vw"
                    unoptimized={photo.direct}
                    style={{ transform: `scale(${slide.imageZoom ?? 1.45})` }}
                    className="object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.45)]"
                  />
                </div>
              ),
            )
          )}
        </div>
      </div>

      {slide.language && (
        <p className="absolute bottom-4 right-4 z-20 rounded-lg bg-brand-red px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-lg">
          {slide.language}
        </p>
      )}
    </article>
  );
}
