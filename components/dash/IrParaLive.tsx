"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDash } from "@/lib/dash/cliente";

// /dash/painel e /dash/sorteios sem live escolhida: vai para a live aberta.
export default function IrParaLive({ destino }: { destino: "painel" | "sorteios" }) {
  const { liveAberta, eu } = useDash();
  const router = useRouter();
  const live = liveAberta ?? (eu.outras[0] ? { showId: eu.outras[0].showId } : null);
  useEffect(() => {
    if (live) router.replace(`/dash/${destino}/${encodeURIComponent(live.showId)}`);
  }, [live, destino, router]);
  if (live) return <main className="d-page text-sm text-d-ink3">Abrindo a live…</main>;
  return (
    <main className="d-page">
      <section className="d-card mx-auto max-w-md space-y-3 p-6 text-center">
        <p className="font-semibold">Nenhuma live chegou ainda</p>
        <p className="text-sm text-d-ink3">Abra a live na Jamble, no Edge com a extensão Village ligada. Em alguns segundos ela aparece aqui.</p>
        <Link href="/dash/lives" className="d-btn d-btn-secondary">
          Ver lives passadas
        </Link>
      </section>
    </main>
  );
}
