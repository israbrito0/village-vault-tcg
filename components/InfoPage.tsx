import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/site";

// Moldura das páginas simples (FAQ, trocas, "em breve"...).
export default function InfoPage({
  title,
  intro,
  whatsappMessage,
  children,
}: {
  title: string;
  intro?: string;
  whatsappMessage?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-xl text-gold-deep">{title}</h1>
      {intro && <p className="mt-3 text-sm leading-relaxed text-cream/80">{intro}</p>}

      {children && <div className="mt-6 space-y-6 text-sm leading-relaxed text-cream/80">{children}</div>}

      <div className="mt-8 flex flex-wrap gap-3">
        {whatsappMessage && (
          <a
            href={whatsappLink(whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded bg-gold px-5 py-2.5 text-sm font-medium text-ink"
          >
            <MessageCircle size={16} strokeWidth={2} />
            Falar no WhatsApp
          </a>
        )}
        <Link
          href="/catalogo"
          className="inline-flex items-center rounded border border-gold-dim px-5 py-2.5 text-sm text-gold-deep hover:border-gold"
        >
          Ver catálogo
        </Link>
      </div>
    </main>
  );
}

export function Question({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-sm text-cream">{q}</h2>
      <div className="mt-1.5 text-cream/75">{children}</div>
    </section>
  );
}
