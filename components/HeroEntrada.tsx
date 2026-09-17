"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import HeroEstatico from "./HeroEstatico";
import type { ProdutoEntrada } from "./HeroCharizard";

// O 3D só existe no navegador: no servidor sai a versão parada, que também
// fica para quem pediu menos movimento no sistema.
const HeroCharizard = dynamic(() => import("./HeroCharizard"), { ssr: false, loading: () => <HeroEstatico /> });

export default function HeroEntrada({ produtos }: { produtos: ProdutoEntrada[] }) {
  const [animar, setAnimar] = useState<boolean | null>(null);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimar(!m.matches);
  }, []);

  if (animar === null || !animar) return <HeroEstatico />;
  return <HeroCharizard produtos={produtos} />;
}
