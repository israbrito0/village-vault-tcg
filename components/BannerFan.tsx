"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BannerColor, FanBanner } from "@/lib/banners";

const THEME: Record<BannerColor, { card: string; coupon: string; cta: string }> = {
  yellow: {
    card: "bg-gradient-to-br from-[#FFD766] to-brand-yellow text-ink",
    coupon: "border-ink/50 bg-white/40 hover:bg-white/70",
    cta: "border-ink bg-ink text-white hover:bg-transparent hover:text-ink",
  },
  blue: {
    card: "bg-gradient-to-br from-[#35B2F0] to-brand-blue text-white",
    coupon: "border-white/70 bg-white/15 hover:bg-white/30",
    cta: "border-white bg-white text-brand-blue hover:bg-transparent hover:text-white",
  },
  red: {
    card: "bg-gradient-to-br from-[#FF7373] to-brand-red text-white",
    coupon: "border-white/70 bg-white/15 hover:bg-white/30",
    cta: "border-white bg-white text-brand-red hover:bg-transparent hover:text-white",
  },
  green: {
    card: "bg-gradient-to-br from-[#44C774] to-brand-green text-white",
    coupon: "border-white/70 bg-white/15 hover:bg-white/30",
    cta: "border-white bg-white text-brand-green hover:bg-transparent hover:text-white",
  },
  ink: {
    card: "bg-gradient-to-br from-[#50576A] to-ink text-white",
    coupon: "border-white/70 bg-white/15 hover:bg-white/30",
    cta: "border-brand-yellow bg-brand-yellow text-ink hover:bg-transparent hover:text-brand-yellow",
  },
};

const AUTOPLAY_MS = 4500;

// Banners empilhados como uma mão de cartas: o da frente fica reto e os
// vizinhos abrem em leque para os lados, girando em volta da base.
export default function BannerFan({
  banners,
  initialIndex = 0,
  compact = false,
}: {
  banners: FanBanner[];
  initialIndex?: number;
  // Versão das páginas internas: menos espaço e sem o título "Promoções".
  compact?: boolean;
}) {
  const [active, setActive] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const count = banners.length;

  const go = useCallback((step: number) => setActive((a) => (a + step + count) % count), [count]);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, go]);

  // Distância circular até o banner da frente: -2, -1, 0, 1, 2...
  function offsetOf(index: number) {
    let d = index - active;
    if (d > count / 2) d -= count;
    if (d < -count / 2) d += count;
    return d;
  }

  async function copyCoupon(banner: FanBanner) {
    if (!banner.coupon) return;
    try {
      await navigator.clipboard.writeText(banner.coupon);
      setCopied(banner.id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Sem permissão de área de transferência: o código continua visível no banner.
    }
  }

  return (
    <section
      aria-label="Promoções"
      className={`overflow-x-clip px-5 ${compact ? "pb-2 pt-6" : "py-10"}`}
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
      {!compact && (
        <h2 className="mb-6 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-ink">Promoções</h2>
      )}

      <div className="relative mx-auto h-[228px] max-w-5xl sm:h-[268px]">
        {banners.map((banner, i) => {
          const d = offsetOf(i);
          const distance = Math.abs(d);
          const isFront = d === 0;
          const theme = THEME[banner.color];

          return (
            <article
              key={banner.id}
              aria-hidden={!isFront}
              onClick={isFront ? undefined : () => setActive(i)}
              style={{
                transform: `translateX(calc(-50% + ${d * 58}%)) rotate(${d * 7}deg) scale(${1 - distance * 0.1})`,
                zIndex: 10 - distance,
                opacity: distance > 2 ? 0 : 1 - distance * 0.12,
                pointerEvents: distance > 2 ? "none" : "auto",
              }}
              className={`absolute bottom-0 left-1/2 h-[210px] w-[86%] max-w-[440px] origin-bottom transition-[transform,opacity] duration-700 ease-out sm:h-[250px] ${
                isFront ? "" : "cursor-pointer"
              }`}
            >
              <div
                className={`relative flex h-full overflow-hidden rounded-2xl p-5 shadow-[0_24px_40px_-20px_rgba(51,56,68,0.6)] ${theme.card} ${
                  isFront ? "" : "pointer-events-none"
                }`}
              >
                <div className="relative z-10 flex max-w-[58%] flex-col text-left">
                  {banner.badge ? (
                    <p className="w-fit rounded-full bg-brand-yellow px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink">
                      {banner.badge}
                    </p>
                  ) : (
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Promoção</p>
                  )}
                  <h3 className="mt-1 font-display text-xl font-extrabold leading-tight sm:text-2xl">{banner.title}</h3>
                  <p className="mt-1 text-xs leading-snug opacity-90">{banner.tagline}</p>

                  {banner.coupon ? (
                    <>
                      <button
                        type="button"
                        tabIndex={isFront ? 0 : -1}
                        onClick={() => copyCoupon(banner)}
                        title="Copiar cupom"
                        className={`mt-3 w-fit rounded border-2 border-dashed px-2.5 py-1 text-sm font-bold tracking-widest transition-colors ${theme.coupon}`}
                      >
                        {copied === banner.id ? "COPIADO!" : banner.coupon}
                      </button>
                      <p className="mt-1 text-[11px] leading-snug opacity-90">
                        {banner.couponText} · informe no WhatsApp
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm font-bold">{banner.couponText}</p>
                  )}

                  {banner.external ? (
                    <a
                      href={banner.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      tabIndex={isFront ? 0 : -1}
                      className={`mt-auto w-fit rounded border-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${theme.cta}`}
                    >
                      {banner.cta} →
                    </a>
                  ) : (
                    <Link
                      href={banner.href}
                      tabIndex={isFront ? 0 : -1}
                      className={`mt-auto w-fit rounded border-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${theme.cta}`}
                    >
                      {banner.cta} →
                    </Link>
                  )}
                </div>

                {banner.display === "photo" ? (
                  // Foto grande do produto (caixa, lata, booster...), inteira e com sombra.
                  <div aria-hidden className="absolute bottom-3 right-2 top-3 w-[44%]">
                    <Image
                      src={banner.images[0].src}
                      alt=""
                      fill
                      sizes="220px"
                      unoptimized={banner.images[0].direct}
                      className="object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)]"
                    />
                  </div>
                ) : banner.display === "empty" && banner.badge ? (
                  // Pré-venda ainda sem foto: espaço reservado bem visível.
                  <div
                    aria-hidden
                    className="absolute bottom-5 right-4 top-5 flex w-[38%] items-center justify-center rounded-xl border-2 border-dashed border-white/40 text-center text-[10px] font-bold uppercase tracking-wide opacity-80"
                  >
                    Foto do
                    <br />
                    produto
                  </div>
                ) : (
                  // Cartas do catálogo desse jogo, abertas em leque no canto do banner.
                  <div aria-hidden className="absolute bottom-4 right-3 top-4 w-[42%]">
                    {banner.images.length > 0
                      ? banner.images.map((img, k) => (
                          <div
                            key={img.src}
                            className="absolute top-1/2 aspect-[63/88] h-[88%] overflow-hidden rounded-lg shadow-lg"
                            style={{
                              right: `${k * 22}%`,
                              transform: `translateY(-50%) rotate(${k === 0 ? 8 : -8}deg)`,
                              zIndex: 2 - k,
                            }}
                          >
                            <Image
                              src={img.src}
                              alt=""
                              fill
                              sizes="140px"
                              unoptimized={img.direct}
                              className="object-cover"
                            />
                          </div>
                        ))
                      : [0, 1].map((k) => (
                          <div
                            key={k}
                            className="absolute top-1/2 aspect-[63/88] h-[80%] rounded-lg border-2 border-white/40 bg-white/15"
                            style={{ right: `${k * 22}%`, transform: `translateY(-50%) rotate(${k === 0 ? 8 : -8}deg)` }}
                          />
                        ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Banner anterior"
          className="rounded-full border-2 border-card-border p-1.5 text-ink/70 transition-colors hover:border-ink hover:text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex gap-2">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Mostrar banner ${banner.title}`}
              aria-current={i === active}
              className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-ink" : "w-2 bg-card-border hover:bg-muted"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Próximo banner"
          className="rounded-full border-2 border-card-border p-1.5 text-ink/70 transition-colors hover:border-ink hover:text-ink"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
