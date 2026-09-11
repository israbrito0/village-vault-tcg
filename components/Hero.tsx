import Link from "next/link";

// Menu inicial: um botão contornado por cor, que enche ao passar o mouse.
const MENU = [
  {
    label: "Catálogo",
    href: "/catalogo",
    className: "border-brand-green text-brand-green hover:bg-brand-green hover:text-white",
  },
  {
    label: "Cartas avulsas",
    href: "/catalogo?subcategoria=cartas-avulsas",
    className: "border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white",
  },
  {
    label: "Selados",
    href: "/catalogo?subcategoria=produtos-selados",
    className: "border-brand-red text-brand-red hover:bg-brand-red hover:text-white",
  },
  {
    label: "Dúvidas?",
    href: "/faq",
    className: "border-brand-yellow text-brand-yellow-text hover:bg-brand-yellow hover:text-ink",
  },
];

const PERKS = ["Frete grátis", "12x sem juros", "5% off no Pix"];

export default function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-5 pb-4 pt-6 text-center sm:pt-10">
      <div className="w-full motion-safe:animate-float">
        <div className="overflow-hidden rounded-xl bg-ink shadow-[0_22px_40px_-18px_rgba(51,56,68,0.55)]">
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

      <div className="motion-safe:animate-fade-in-up">
        <h1 className="mt-8 font-display text-xl leading-snug text-ink sm:text-3xl">
          Toda coleção começa com uma boa carta
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pokémon, Magic e outros TCGs, com condição e estoque verificados.
        </p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {PERKS.map((perk) => (
            <li key={perk} className="rounded-full bg-surface px-3 py-1 text-[11px] text-ink/80">
              {perk}
            </li>
          ))}
        </ul>
      </div>

      <nav aria-label="Menu inicial" className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {MENU.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`rounded-md border-2 bg-white px-3 py-3 text-[13px] font-bold uppercase tracking-wide shadow-sm transition-colors ${item.className}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
