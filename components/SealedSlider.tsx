"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SealedSlideView, SealedTheme } from "@/lib/banners";
import { MAX_INSTALLMENTS, PIX_DISCOUNT } from "@/lib/site";

// Degradês de fundo por tema, com o brilho atrás das fotos dos produtos.
const THEMES: Record<SealedTheme, { bg: string; text: string; eyebrow: string; cta: string; glow: string }> = {
  gold: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#FFF6D2_0%,#F7C948_42%,#A8680F_100%)]",
    text: "text-ink",
    eyebrow: "bg-ink text-white",
    cta: "border-ink bg-ink text-white hover:bg-transparent hover:text-ink",
    glow: "bg-white/70",
  },
  fire: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#FFE08A_0%,#E8731A_40%,#4A1C06_100%)]",
    text: "text-white",
    eyebrow: "bg-black/55 text-white",
    cta: "border-white bg-white text-[#9A3B0A] hover:bg-transparent hover:text-white",
    glow: "bg-[#FFD27A]/80",
  },
  night: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#7A83A3_0%,#333844_55%,#121419_100%)]",
    text: "text-white",
    eyebrow: "bg-brand-yellow text-ink",
    cta: "border-brand-yellow bg-brand-yellow text-ink hover:bg-transparent hover:text-brand-yellow",
    glow: "bg-[#AFC2FF]/50",
  },
  ocean: {
    bg: "bg-[radial-gradient(ellipse_at_68%_50%,#BDEBFF_0%,#158BCA_48%,#083452_100%)]",
    text: "text-white",
    eyebrow: "bg-black/40 text-white",
    cta: "border-white bg-white text-brand-blue hover:bg-transparent hover:text-white",
    glow: "bg-white/60",
  },
};

const PERKS = ["Frete grátis", `Até ${MAX_INSTALLMENTS}x sem juros`, `${Math.round(PIX_DISCOUNT * 100)}% off no Pix`];

// Posição de cada foto no leque de produtos: a do meio na frente, as outras atrás.
const PHOTO_SLOTS = [
  "left-1/2 z-20 h-[92%] w-[46%] -translate-x-1/2",
  "left-[4%] z-10 h-[74%] w-[38%] -rotate-[8deg]",
  "right-[4%] z-10 h-[74%] w-[38%] rotate-[8deg]",
];

const AUTOPLAY_MS = 5500;

export default function SealedSlider({ slides }: { slides: SealedSlideView[] }) {
  const [active, setActive] = useState(0);
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
    <section aria-label="Produtos lacrados" className="px-3 pt-4 sm:px-5">
      <div
        className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl shadow-[0_18px_40px_-22px_rgba(51,56,68,0.6)]"
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
              className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/25 p-1.5 text-white transition-colors hover:bg-black/45 sm:left-4"
            >
              <ChevronLeft size={26} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próximo banner"
              className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/25 p-1.5 text-white transition-colors hover:bg-black/45 sm:right-4"
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
                  className={`h-3 w-3 rounded-full border-2 border-white transition-colors ${
                    i === active ? "bg-white" : "bg-transparent hover:bg-white/50"
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
  const ctaClass = `mt-5 inline-flex w-fit rounded border-2 px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide transition-colors ${theme.cta}`;

  return (
    <article aria-hidden={!isActive} className={`relative w-full shrink-0 overflow-hidden ${theme.bg} ${theme.text}`}>
      {slide.background && (
        <>
          <Image src={slide.background} alt="" fill sizes="(min-width: 1280px) 1280px, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        </>
      )}

      {/* Laterais largas o bastante para as setas não ficarem em cima do texto. */}
      <div className="relative grid min-h-[430px] grid-cols-1 items-center gap-2 px-12 pb-12 pt-8 sm:min-h-[340px] sm:grid-cols-[1fr_1.15fr] sm:px-20 lg:min-h-[400px]">
        <div className="z-10 flex flex-col items-center text-center sm:items-start sm:text-left">
          <p className={`rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${theme.eyebrow}`}>
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold uppercase leading-[0.95] drop-shadow-[0_3px_8px_rgba(0,0,0,0.25)] sm:text-5xl lg:text-6xl">
            {slide.title}
          </h2>
          {slide.subtitle && <p className="mt-3 max-w-sm text-sm font-medium opacity-90">{slide.subtitle}</p>}

          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] font-extrabold uppercase tracking-wide sm:justify-start">
            {PERKS.map((perk) => (
              <li key={perk}>{perk}</li>
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

        {/* Fotos dos produtos em leque, com um brilho atrás. */}
        <div aria-hidden className="relative h-[190px] sm:h-full sm:min-h-[260px]">
          <div className={`absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${theme.glow}`} />
          {slide.photos.length > 0
            ? slide.photos.map((photo, k) => (
                <div key={photo.src} className={`absolute top-1/2 -translate-y-1/2 ${PHOTO_SLOTS[k]}`}>
                  <Image
                    src={photo.src}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 320px, 45vw"
                    unoptimized={photo.direct}
                    className="object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.45)]"
                  />
                </div>
              ))
            : PHOTO_SLOTS.map((slot, k) => (
                <div
                  key={k}
                  className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-xl border-2 border-dashed border-current/40 bg-white/10 text-center text-[10px] font-bold uppercase tracking-wide opacity-70 ${slot}`}
                >
                  {k === 0 && (
                    <>
                      Foto do
                      <br />
                      produto
                    </>
                  )}
                </div>
              ))}
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
