import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";
import PainelMetricas from "@/components/PainelMetricas";

// Página privada: fora do menu, fora do sitemap e sem indexação. Os números só
// aparecem para quem tem a chave de métricas.
export const metadata: Metadata = {
  title: "Métricas",
  robots: { index: false, follow: false },
};

export default function MetricasPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <PageTitle title="Métricas" />
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-ink/80">
        Faturamento das lives em tempo real, ticket médio, projeção do mês e total acumulado.
      </p>
      <div className="mt-6">
        <PainelMetricas />
      </div>
    </main>
  );
}
