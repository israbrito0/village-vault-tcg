import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { ACCENT_BUTTON, BUTTON_BASE } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-col items-center px-5 py-16 text-center">
      <Wordmark />
      <h1 className="mt-12 font-display text-2xl text-ink">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted">Esse endereço não existe ou o produto saiu do catálogo.</p>
      <div className="mt-8 grid grid-cols-2 gap-4">
        <Link href="/" className={`${BUTTON_BASE} ${ACCENT_BUTTON.green} w-[150px] px-3 py-3 text-[12px]`}>
          Início
        </Link>
        <Link href="/catalogo" className={`${BUTTON_BASE} ${ACCENT_BUTTON.blue} w-[150px] px-3 py-3 text-[12px]`}>
          Catálogo
        </Link>
      </div>
    </main>
  );
}
