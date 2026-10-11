"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDash } from "@/lib/dash/cliente";
import { Botao } from "@/components/dash/ui";

// /dash/painel e /dash/sorteios sem live escolhida: vai para a live atual.
export default function IrParaLive({ destino }: { destino: "painel" | "sorteios" }) {
  const { eu } = useDash();
  const router = useRouter();
  const live = eu.live ?? eu.outras[0] ?? null;
  useEffect(() => {
    if (live) router.replace(`/dash/${destino}/${encodeURIComponent(live.showId)}`);
  }, [live, destino, router]);
  if (live) return <p className="text-[13px] text-[#8b93a7]">Abrindo a live...</p>;
  return (
    <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-[#171a21] p-6 text-center">
      <p className="font-semibold text-white">Nenhuma live chegou ainda</p>
      <p className="mt-2 text-[13px] text-[#8b93a7]">Abra a live na Jamble, no Edge com a extensão Village ligada. Em alguns segundos ela aparece aqui.</p>
      <Link href="/dash/lives">
        <Botao className="mt-4">Ver lives passadas</Botao>
      </Link>
    </div>
  );
}
