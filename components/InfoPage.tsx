import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/site";
import PageTitle from "./PageTitle";
import Promocoes from "./Promocoes";
import { ACCENT_BUTTON, BUTTON_BASE } from "./ui";

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
    <>
      <Promocoes />
      <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
        <PageTitle title={title} />
        {intro && <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-relaxed text-ink/80">{intro}</p>}

        {children && <div className="mt-8 space-y-3 text-sm leading-relaxed text-ink/80">{children}</div>}

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {whatsappMessage && (
            <a
              href={whatsappLink(whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BUTTON_BASE} ${ACCENT_BUTTON.green} inline-flex w-[200px] items-center justify-center gap-2 px-4 py-3 text-[12px]`}
            >
              <MessageCircle size={16} strokeWidth={2.25} />
              Falar no WhatsApp
            </a>
          )}
          <Link
            href="/catalogo"
            className={`${BUTTON_BASE} ${ACCENT_BUTTON.blue} inline-flex w-[200px] items-center justify-center px-4 py-3 text-[12px]`}
          >
            Ver catálogo
          </Link>
        </div>
      </main>
    </>
  );
}

export function Question({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <h2 className="text-[12px] font-bold uppercase tracking-wide text-ink">{q}</h2>
      <div className="mt-1.5 text-ink/75">{children}</div>
    </section>
  );
}
