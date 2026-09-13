import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";
import ContaCliente from "@/components/ContaCliente";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

export default function ContaPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <PageTitle title="Minha conta" />
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-ink/80">
        Seus dados, endereços de entrega e o frete calculado saindo de Maceió.
      </p>
      <div className="mt-6">
        <ContaCliente />
      </div>
    </main>
  );
}
