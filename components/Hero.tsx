import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import Wordmark from "./Wordmark";
import { ACCENT_BUTTON, Accent, BUTTON_BASE } from "./ui";

const MENU: { label: string; href: string; accent: Accent }[] = [
  { label: "Catálogo", href: "/catalogo", accent: "green" },
  { label: "Cartas avulsas", href: "/catalogo?subcategoria=cartas-avulsas", accent: "blue" },
  { label: "Selados", href: "/catalogo?subcategoria=produtos-selados", accent: "red" },
  { label: "Dúvidas?", href: "/faq", accent: "yellow" },
];

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center px-5 pb-10 pt-14 text-center sm:min-h-[92vh] sm:pt-10">
      {/* Atalhos discretos: a página inicial não tem o cabeçalho completo. */}
      <div className="absolute right-4 top-4 flex gap-4 text-ink/70">
        <Link href="/catalogo" aria-label="Buscar produtos" className="hover:text-ink">
          <Search size={20} strokeWidth={1.75} />
        </Link>
        <Link href="/carrinho" aria-label="Carrinho" className="hover:text-ink">
          <ShoppingCart size={20} strokeWidth={1.75} />
        </Link>
      </div>

      <div className="motion-safe:animate-fade-in-up">
        <Wordmark large />
      </div>

      <div className="relative mt-12 w-full max-w-xl sm:mt-16">
        <div className="motion-safe:animate-float-tilt">
          <div className="overflow-hidden rounded-xl bg-ink shadow-[0_30px_50px_-20px_rgba(51,56,68,0.6)]">
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/hero-poster.jpg"
              className="block aspect-[1024/460] w-full object-cover"
            >
              <source src="/hero-video.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <div
          aria-hidden
          className="mx-auto mt-10 h-5 w-3/4 rounded-[50%] bg-ink/40 blur-lg motion-safe:animate-shadow-pulse"
        />
      </div>

      <nav aria-label="Menu inicial" className="mt-12 grid grid-cols-2 gap-4">
        {MENU.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`${BUTTON_BASE} ${ACCENT_BUTTON[item.accent]} w-[150px] px-3 py-3 text-[13px] sm:w-[180px]`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <p className="mt-8 text-xs text-muted">Frete grátis · 12x sem juros · 5% off no Pix</p>
    </section>
  );
}
